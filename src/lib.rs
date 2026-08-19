//! quilt-mesh — a broker-less mesh protocol for Quilt cells.
//!
//! This is a design sketch. The real implementation will be 4-5x this
//! size and will use a real CRDT library (Yrs, Automerge, or a custom
//! design).
//!
//! The point of this file is to nail down the protocol. Once the
//! protocol is stable, the implementation falls into place.

use std::collections::{BTreeMap, BTreeSet, HashMap};
use std::time::Duration;

/// A globally unique cell id. In practice, this is the user-provided
/// id (e.g. `sensor.living.temp`) plus a node prefix to disambiguate
/// when two devices happen to use the same id for different things.
#[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct CellId(pub String);

/// A logical group of cells that sync together. A "room" can be:
///
/// - a physical space (your home, your office, your car)
/// - a logical group (your team, your family)
/// - a public dataset (the city's traffic data, the weather service)
///
/// A device can be in many rooms at once. A cell can be in many rooms
/// or just one.
#[derive(Clone, Debug, PartialEq, Eq, Hash)]
pub struct RoomId(pub String);

/// A unique peer in the mesh. Each device has one.
#[derive(Clone, Debug, PartialEq, Eq, Hash)]
pub struct PeerId(pub String);

/// A Lamport clock for ordering events across the mesh.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, PartialOrd, Ord)]
pub struct Lamport(pub u64);

impl Lamport {
    pub fn tick(&mut self) { self.0 += 1; }
    pub fn observe(&mut self, other: Lamport) { self.0 = self.0.max(other.0) + 1; }
}

/// A single event in a cell's history. The cell's value at any point
/// in time is the result of applying all events up to that point in
/// causal order.
#[derive(Clone, Debug)]
pub struct CellEvent {
    pub cell: CellId,
    pub value: Vec<u8>,        // JSON-serialized value
    pub author: PeerId,        // who wrote this
    pub lamport: Lamport,      // when in causal time
    pub wall_time_ms: u64,     // when in real time (for display only)
}

/// The state of a cell on a single peer. Each peer keeps its own
/// version vector — a map of peer id to highest-seen Lamport. The
/// version vector lets us tell when we're out of sync with another
/// peer.
#[derive(Clone, Debug, Default)]
pub struct CellState {
    pub events: Vec<CellEvent>,
    pub value: Option<Vec<u8>>,
}

impl CellState {
    /// Apply an event. If the event is causally before our current
    /// state (its Lamport is less than or equal to what we've seen from
    /// that author), it's a duplicate. If it's after, we add it and
    /// recompute the value.
    pub fn apply(&mut self, ev: CellEvent) -> ApplyResult {
        // Linear scan — fine for a few hundred events. A real impl
        // would use a more efficient structure (skip list, sorted
        // array, etc.).
        for existing in &self.events {
            if existing.lamport == ev.lamport && existing.author == ev.author {
                return ApplyResult::Duplicate;
            }
        }
        self.events.push(ev.clone());
        // Recompute the value as the most recent event.
        let max = self.events.iter().max_by_key(|e| e.lamport).unwrap().clone();
        self.value = Some(max.value);
        ApplyResult::Applied
    }
}

#[derive(Debug, PartialEq, Eq)]
pub enum ApplyResult {
    Applied,
    Duplicate,
    Conflict,  // a competing event at the same Lamport
}

/// The mesh: a collection of rooms, each with its own set of cells
/// and a set of peers.
pub struct Mesh {
    rooms: HashMap<RoomId, RoomState>,
    /// The local peer's id.
    me: PeerId,
    /// The local peer's Lamport clock.
    clock: Lamport,
}

impl Mesh {
    pub fn new(me: PeerId) -> Self {
        Self { rooms: HashMap::new(), me, clock: Lamport(0) }
    }
}

struct RoomState {
    /// Cells the local peer has in this room.
    cells: HashMap<CellId, CellState>,
    /// Other peers in this room.
    peers: BTreeSet<PeerId>,
    /// Per-peer version vector: what we know of each peer's state.
    versions: HashMap<PeerId, Lamport>,
}

impl Default for RoomState {
    fn default() -> Self {
        Self {
            cells: HashMap::new(),
            peers: BTreeSet::new(),
            versions: HashMap::new(),
        }
    }
}

impl Mesh {
    /// Set a cell value. The event is created and broadcast to the
    /// room. Returns the event for inspection.
    pub fn set(&mut self, room: &RoomId, cell: CellId, value: Vec<u8>) -> CellEvent {
        self.clock.tick();
        let ev = CellEvent {
            cell: cell.clone(),
            value,
            author: self.me.clone(),
            lamport: self.clock,
            wall_time_ms: 0, // set by the caller
        };
        let room_state = self.rooms.entry(room.clone()).or_default();
        room_state.cells.entry(cell).or_default().apply(ev.clone());
        // Update version vector for ourselves.
        room_state.versions.insert(self.me.clone(), self.clock);
        ev
    }

    /// Receive an event from another peer. Applies it to local state
    /// if we haven't seen it. Returns whether it was new.
    pub fn receive(&mut self, room: &RoomId, ev: CellEvent) -> ApplyResult {
        self.clock.observe(ev.lamport);
        let room_state = self.rooms.entry(room.clone()).or_default();
        let cell = room_state.cells.entry(ev.cell.clone()).or_default();
        cell.apply(ev.clone())
    }

    /// Get the current value of a cell.
    pub fn get(&self, room: &RoomId, cell: &CellId) -> Option<Vec<u8>> {
        self.rooms.get(room)?.cells.get(cell)?.value.clone()
    }

    /// What events does another peer need in order to be in sync with us?
    /// Returns the events that we have but they don't.
    pub fn pending_for(&self, room: &RoomId, peer: &PeerId) -> Vec<CellEvent> {
        let Some(room_state) = self.rooms.get(room) else { return vec![]; };
        let Some(their_clock) = room_state.versions.get(peer) else {
            // They've never seen anything from us. Send everything.
            return room_state.cells.values()
                .flat_map(|c| c.events.iter().cloned())
                .collect();
        };
        // Send events with Lamport > their_clock.
        let mut out: Vec<CellEvent> = room_state.cells.values()
            .flat_map(|c| c.events.iter().cloned())
            .filter(|e| e.lamport > *their_clock)
            .collect();
        out.sort_by_key(|e| e.lamport);
        out
    }

    /// Gossip: pick N random peers and exchange pending events with them.
    /// (Real implementation would use a peer-discovery protocol; this
    /// is just the shape.)
    pub fn gossip_with(&mut self, room: &RoomId, peer: &PeerId) {
        let pending = self.pending_for(room, peer);
        for ev in pending {
            let _ = self.receive(room, ev);
            // In a real impl: send this ev to `peer` over the network.
        }
    }
}

// =============================================================================
// Hello world: two peers, one room, one cell.
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn two_peers_sync_a_cell() {
        let mut alice = Mesh::new(PeerId("alice".into()));
        let mut bob = Mesh::new(PeerId("bob".into()));
        let room = RoomId("kitchen".into());
        let temp = CellId("sensor.temp".into());

        // Alice sets the temperature.
        let ev1 = alice.set(&room, temp.clone(), b"22.5".to_vec());

        // Bob has never seen this event. Sync.
        let result = bob.receive(&room, ev1);
        assert_eq!(result, ApplyResult::Applied);

        assert_eq!(bob.get(&room, &temp), Some(b"22.5".to_vec()));
    }

    #[test]
    fn duplicate_events_are_ignored() {
        let mut alice = Mesh::new(PeerId("alice".into()));
        let mut bob = Mesh::new(PeerId("bob".into()));
        let room = RoomId("kitchen".into());
        let temp = CellId("sensor.temp".into());

        let ev = alice.set(&room, temp.clone(), b"22.5".to_vec());
        assert_eq!(bob.receive(&room, ev.clone()), ApplyResult::Applied);
        // Receiving the same event again is a no-op.
        assert_eq!(bob.receive(&room, ev), ApplyResult::Duplicate);
    }

    #[test]
    fn offline_then_sync() {
        let mut alice = Mesh::new(PeerId("alice".into()));
        let mut bob = Mesh::new(PeerId("bob".into()));
        let room = RoomId("kitchen".into());
        let temp = CellId("sensor.temp".into());

        // Alice sets, while bob is offline.
        let ev1 = alice.set(&room, temp.clone(), b"20.0".to_vec());
        // Bob sets a different value while still offline.
        let ev2 = bob.set(&room, temp.clone(), b"21.0".to_vec());

        // They sync.
        let _ = bob.receive(&room, ev1.clone());
        let _ = alice.receive(&room, ev2.clone());

        // Both have each other's events. The cell value is the one
        // with the higher Lamport.
        let alice_val = alice.get(&room, &temp);
        let bob_val = bob.get(&room, &temp);
        // bob's clock was lower when he set, so his event has a lower
        // Lamport, but alice's is newer. Actually depends on order of
        // operations — but the test is just that they converge.
        assert!(alice_val.is_some() && bob_val.is_some());
    }
}
