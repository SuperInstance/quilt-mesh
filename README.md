# 🕸️ quilt-mesh

> **A broker-less CRDT mesh for Quilt cells. Two devices, no server, no internet, no account — they sync.**

When they come back online, they reconcile. When they go offline, they keep working. The mesh is the network.

[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Tests](https://img.shields.io/badge/tests-3%2F3-brightgreen)]()
[![Sync](https://img.shields.io/badge/sync-CRDT%20%2B%20Lamport-blue)]()
[![Try it](https://img.shields.io/badge/try-live-7ec699)](https://superinstance.github.io/quilt/landing/quilt-mesh.html)

**[→ Try it live in your browser](https://superinstance.github.io/quilt/landing/quilt-mesh.html)** — two browser tabs sync cells in real time via BroadcastChannel.

---

## ⚡ See it in 30 seconds

```rust
use quilt_mesh::{QuiltMesh, CellEvent};

let alice = QuiltMesh::new("alice");
let bob   = QuiltMesh::new("bob");

// Alice updates a cell.
alice.set("counter", 1);
alice.set("counter", 2);

// Gossip. Peer-to-peer. No server.
alice.gossip_with(&bob);

// Bob now has the latest.
let state = bob.get("counter");
assert_eq!(state, Some(2));
```

That's the whole thing. `set`, `gossip_with`, automatic reconciliation. No broker. No central state. No single point of failure.

---

## 🎬 The mesh, visualized

```
   ┌────────────────────────────────────────────────────────────┐
   │                     quilt-mesh                             │
   │                                                            │
   │                ┌──────────┐                                │
   │                │  Alice   │                                │
   │                │          │                                │
   │                │ counter: │                                │
   │                │   2      │                                │
   │                │          │                                │
   │                │ clock: 2 │                                │
   │                │ peer: {} │                                │
   │                └────┬─────┘                                │
   │                     │                                      │
   │                     │  gossip_with                         │
   │                     │  (events: [(counter, 1, t=1),       │
   │                     │              (counter, 2, t=2)])     │
   │                     ▼                                      │
   │                ┌──────────┐                                │
   │                │  Bob     │                                │
   │                │          │                                │
   │                │ counter: │                                │
   │                │   2      │  (after gossip)                │
   │                │          │                                │
   │                │ clock: 2 │                                │
   │                │ peer:    │                                │
   │                │   {alice:│                                │
   │                │     (ctr,│                                │
   │                │     2, 2)│                               │
   │                │   }      │                               │
   │                └──────────┘                                │
   │                                                            │
   │   No server. No router. No internet. Just two nodes.       │
   │                                                            │
   └────────────────────────────────────────────────────────────┘
```

---

## 🎁 What's in the box

- **CRDT-based state** — eventually consistent, conflict-free
- **Lamport clocks** — total ordering across peers
- **Per-peer version vectors** — "I've seen what alice saw up to t=N"
- **Offline-first** — work locally, sync when you meet
- **Broker-less** — no central server, no internet required
- **~250 lines** of Rust, **0 external dependencies** for the core
- **3 unit tests, 0 failures** — verified for the basic patterns

---

## 🏗️ Architecture

```
   ┌──────────────────────────────────────────────────────────────┐
   │                       QuiltMesh                              │
   │                                                              │
   │   ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐    │
   │   │   RoomState   │  │   Lamport    │  │   Peer Registry  │    │
   │   │              │  │              │  │                  │    │
   │   │   cells:     │  │   clock: 5   │  │   {              │    │
   │   │   {ctr: 2}   │  │   tick()     │  │     alice: v[1]  │    │
   │   │              │  │   observe()  │  │     bob:   v[0]  │    │
   │   │              │  │              │  │   }              │    │
   │   └──────────────┘  └──────────────┘  └──────────────────┘    │
   │            │                  │                    │        │
   │            └──────────────────┼────────────────────┘        │
   │                               ▼                             │
   │                      ┌──────────────────┐                    │
   │                      │   CellEvent      │  gossip payload   │
   │                      │   cid, value, t  │                    │
   │                      └──────────────────┘                    │
   │                                                              │
   └──────────────────────────────────────────────────────────────┘
```

Three structures, one protocol:
- **RoomState** — the merged state across all peers
- **Lamport clock** — the causal ordering
- **Peer registry** — what each peer has seen

The `CellEvent` is the gossip payload. Sent, received, applied, merged. The whole protocol.

---

## 🔄 How gossip works

```
   Alice has:                 Bob has:
   ┌─────────────────┐        ┌─────────────────┐
   │ counter = 2     │        │ counter = 5     │
   │ t = 2           │        │ t = 1           │
   │                 │        │                 │
   │ version_vector: │        │ version_vector: │
   │   {alice: 2,    │        │   {alice: 1,    │
   │    bob: 0}      │        │    bob: 1}      │
   └─────────────────┘        └─────────────────┘

   1. Alice sends her version_vector to Bob.
   2. Bob sees he's behind on alice. He requests events.
   3. Alice sends (counter, 2, t=2).
   4. Bob applies: his counter was t=1, alice's is t=2, take alice's.
   5. Bob updates his version_vector: {alice: 2, bob: 1}.

   After:                       After:
   Alice: counter = 2           Bob: counter = 2
   {alice: 2, bob: 0}          {alice: 2, bob: 1}

   Bidirectional sync is symmetric: Bob also sends his events back.
```

---

## 💡 Use cases

| Use case | What you build |
| --- | --- |
| **Phone ↔ laptop sync** | No server. Direct WiFi, Bluetooth, USB. |
| **Team offline collaboration** | "The bus broke down, but our sheets still work." |
| **Family calendar** | Mom's phone, dad's phone, kids' tablets. They all stay in sync. |
| **IoT mesh** | 50 sensors, no cloud. They gossip. |
| **Censorship-resistant apps** | No central server to take down. |
| **Disaster response** | Cell towers down, but the mesh still works via LoRa. |

---

## 🛠️ Develop

```bash
git clone https://github.com/SuperInstance/quilt-mesh
cd quilt-mesh
cargo test
```

3 tests, 0 failures. The basic patterns: two peers sync, duplicate events ignored, offline-then-sync.

---

## 📚 API reference

```rust
pub struct QuiltMesh {
    pub id: PeerId,
    pub room: RoomState,
}

impl QuiltMesh {
    pub fn new(id: impl Into<PeerId>) -> Self;
    pub fn set(&mut self, cid: impl Into<CellId>, value: Value);
    pub fn get(&self, cid: &str) -> Option<Value>;
    pub fn tick(&mut self) -> LamportTime;
    pub fn observe(&mut self, t: LamportTime);
    pub fn gossip_with(&mut self, peer: &mut QuiltMesh);
    pub fn pending_events_for(&self, peer: &QuiltMesh) -> Vec<CellEvent>;
    pub fn apply(&mut self, event: CellEvent);
    pub fn version_vector(&self) -> &VersionVector;
}

pub struct CellEvent {
    pub cid: CellId,
    pub value: Value,
    pub t: LamportTime,
    pub author: PeerId,
}
```

---

## 🛣️ Roadmap

1. **Multi-hop gossip** — relay through intermediate peers
2. **Merkle DAG sync** — efficient diff over millions of cells
3. **Authenticated gossip** — sign every event with a private key
4. **Conflict resolution policies** — LWW, max-value, custom
5. **Compression** — gzip the gossip payload
6. **WebRTC transport** — browser-to-browser directly, no server
7. **LoRa transport** — for the IoT mesh case

---

## 🔗 Related

- [Quilt (TypeScript)](https://github.com/SuperInstance/quilt) — the canonical reactive runtime
- [Quilt (Rust)](https://github.com/SuperInstance/quilt-rust) — the desktop runtime
- [Quilt Time](https://github.com/SuperInstance/quilt-time) — time travel (combine with mesh for "rewind to before disconnect")
- [Quilt Vault](https://github.com/SuperInstance/quilt-vault) — encryption (mesh + vault = encrypted peer-to-peer)
- [Quilt Live](https://github.com/SuperInstance/quilt-live) — single-file browser runtime
- [Quilt 5-year roadmap](https://github.com/SuperInstance/quilt/blob/main/quilt-roadmap-2026.md)

## License

MIT.
