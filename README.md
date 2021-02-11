# PhaseLogic
 
 PhaseLogic is a script for Logic Scripter that handles several things:
 - Sequences
 - Arpeggios
 - Chords (major, minor chord progression)
 - Humanizing velocities and beat position of the sequence notes
 
 etc.
 
# Examples

## Play simple quarter-note sequence
```js
var sequenceDenominators = [4, 4, 4, 4]
```

## Play quarter-note sequence with crescendo
```js
var sequenceDenominators = [4, 4, 4, 4]
var sequenceVelocities = [30, 40, 60, 100]
```

## Play chord progression sequence
```js
var sequenceDenominators = [4, 4, 4, 4]
var sequenceChords = ["maj", "min"]
```

## Play Arpeggio
```js
var sequenceDenominators = [4, 4, 4, 4]
var sequencePitches = [0, 3, 5, 3]
```

# Advanced Features
## Chord Automation

Chords can be automated by specifying the `automatedChords` array. If this is defined, it will override the step sequence chords and use the automation value for `automatedChordValue`. This allows you to automate chord progressions as needed.

```js
var automatedChords = ["maj", "p4"]
```

 
 Feel free to use and enjoy
