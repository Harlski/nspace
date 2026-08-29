# Mosquito Tag is an in-room game, not a Match and not World Cup

Mosquito Tag plays in the room everyone is already in. It does not teleport anyone onto a Match Pitch, and it is not part of the seasonal World Cup module (`*/worldcup/`, `WORLDCUP_ENABLED`).

Soccer Challenge means “accept starts a 1v1 Match now” and needs isolation (private ball, goals, stands). Mosquito Tag needs the opposite: a waiting Tag Call, N Joiners, the Caller Starts, chase among Bystanders. Reusing the Match machine would fight [ephemeral Match Pitches](../../worldcup/adr/0001-ephemeral-match-pitches.md). Putting it under World Cup would make a year-round social game deletable with the season and would keep the Games Wheel soccer-flag-gated.

**Considered options:** generalize Challenge into a multi-game lobby used by soccer and Tag — rejected for v1; soccer’s accept-starts-now contract stays. Invite / Play Space leaf on the Games Wheel — rejected; this game does not leave the room. Participant-only free-move in the Hub — rejected; pitch free-move is for obstacle-free rooms only.
