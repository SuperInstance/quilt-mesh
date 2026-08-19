# quilt-mesh

> A broker-less, CRDT-based mesh protocol for Quilt cells.

Two devices, no server, no internet, no account — share cells. The cells
sync. When they come back online, they reconcile. The mesh is the network.

## The thesis

Quilt today is a single engine. Quilt tomorrow is a *mesh* of engines,
running on many devices, syncing their cells through a peer-to-peer
protocol with no central broker.

- Your phone, your watch, your car, your fridge, your lights — each
  one is a Quilt node.
- Each node has a set of cells.
- Some cells are private (your calendar, your budget).
- Some cells are in a "room" with other devices (your home, your
  office, your carpool).
- When a cell changes on one device, the change propagates to every
  other device in the room.
- When a device is offline, it queues changes locally. When it comes
  back, it catches up.
- When two devices set the same cell at the same time, both writes
  survive, ordered by causal time.

The mesh is broker-less. There's no cloud service. There's no central
authority. The mesh is the network.

## What's in the sketch

`src/lib.rs` is a design sketch. The shapes are:

- `Mesh` — a peer's view of all the rooms it's in.
- `RoomState` — a peer's view of one room, with its cells and
  version vector.
- `CellState` — a peer's view of one cell, with its event log.
- `CellEvent` — a single change, with author and Lamport clock.

The protocol uses Lamport clocks + per-peer version vectors. Conflict
resolution is "last writer wins by Lamport". For more sophisticated
conflict resolution, the protocol can be extended to use a Yjs-style
or Automerge-style CRDT.

## Test

```bash
cargo test
```

## Status

Sketch only. The shapes are stable, but the implementation is
incomplete. The next step is:

1. **Wire format** — JSON or postcard-encoded events.
2. **Transport** — WebSocket for online, BLE for proximity, LoRa for
   long-range, hardwired for fixed.
3. **Discovery** — mDNS for local network, Bluetooth LE for nearby
   devices, a public DHT for global.
4. **Persistence** — store the event log in SQLite or a flat file.
5. **Compression** — gzip the event stream for transfer.
6. **First release** — a Rust crate that can sync cells over a
   WebSocket. Tested on a 100-node simulation.

## Why a mesh, not a server?

Because the cell model *is* a CRDT. A cell has a single value, a
history of changes, and a clear merge rule. The mesh IS the database.
There's no need for a central server.

This is also why Quilt is uniquely positioned for the mesh: the
runtime is small enough to run on an ESP32, and the cell model is
small enough to sync over BLE. Cloud-first spreadsheets can't do
this. Quilt can.

## Related

- [Quilt (TypeScript)](https://github.com/SuperInstance/quilt) — the
  canonical runtime, in the browser.
- [Quilt (Rust)](https://github.com/SuperInstance/quilt-rust) — the
  desktop runtime.
- [Quilt Live](https://github.com/SuperInstance/quilt-live) — the
  single-file browser runtime.
- [Quilt 5-year roadmap](../../quilt-roadmap-2026.md) — the bigger
  picture.

## License

MIT.
