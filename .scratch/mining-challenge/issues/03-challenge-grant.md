# 03 - A person opens a Mining Challenge

**Status:** done

## What to build

A game admin can open a Mining Challenge on another wallet from the profile Actions list and from `/admin`. `/admin` can grant that ability to other wallets. The list starts empty. A Challenge Grant holder gets only "Mining Challenge" on the other player's profile. They cannot target themselves or a game admin, and Player Level does not grant the action. An ineligible target gets a clear refusal.

## Acceptance criteria

- [x] A game admin can open a Mining Challenge without the address being hot
- [x] `/admin` can add and remove a Challenge Grant, and the list survives a restart
- [x] A grant holder can open a Mining Challenge from the other player's profile and cannot ban, freeze, or open `/admin`
- [x] A grant holder is refused for themselves, a game admin, an immune wallet, a wallet already challenged, and a wallet under Mining Restriction
- [x] A wallet that is not an admin and has no grant is refused

## Blocked by

- 01 - Automatic Mining Challenge from a shared address
