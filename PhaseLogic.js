/* 
	PhaseLogic, by Coin Bump

	A tool for creating sequences, arpeggios, and so in in Scripter.
*/
var sequenceDenominators = [4, 4, 4, 4]
//var sequenceChords = ["maj"] 		// EXAMPLE: ["maj", "min", "aug"]
//var sequenceVelocities = [100]	// Comment out to use played velocities
var sequencePitches = [0]
var sequenceGates = [1]
var sequenceChances = [1]

// SET THIS IN LOGIC Parameters, not here
var sequenceLength = 0				// Value 0 is ignored
/*
	Basic Sequence types (ABOVE)

	DESCRIPTION:
	Comment out sequence settings you don't want/need to be modified
	
	**********
	sequenceDenominators
	Play sequence notes by note denominator (whole note: 1, half note: 2, quarter note: 4)

	**********
	sequenceLength
	If 0, sequenceLength is ignored and the sequence length is determined by the number of step values
	However, it might be convenient to have a repeating pattern like so: [4, 8, 16] that repeats several times.
	In this case, set sequenceLength to be greater than the number of step values

	**********
	sequenceVelocities (default is [100])
	Velocity steps for sequence

	**********
	sequenceChords

	Specifies that chords be played for each step in sequence (root note determines root of chord)

	FORMAT:
	["maj", "min", "dim", "aug", ...]

	**********
	sequencePitches

	Pitch offset from root pitch for arpeggios

	**********
	sequenceGates

	Gate value (0-1) for modifying step durations. .5 is 50% of note duration, 1 is 100% of duration
	
	**********
	sequenceChances

	Chance value (0-1) step to play. .5 is 50% chance to play, 1 is 100% (always plays)
*/

/*
	PhaseMIDIControlChannel

	DESCRIPTION:
	Standard MIDI CC (control channel) values
*/
const PhaseMIDIControlChannel = {
	modWheel: 1,
	volume: 2,
	pan: 10,
	sustain: 64
}


/*
	SETTING: sequenceControlChannels

	DESCRIPTION:
	Sends control channel events for each step in a sequence.

	FORMAT:
	[firstControlChannel, [step1Value, step2Value, ...]],
	...
	[lastControlChannel, [step1Value, step2Value, ...]]
*/
var sequenceControlChannels = new Map([
	// [PhaseMIDIControlChannel.pan, [0, 127]]
])

/*
	=============================================
	PhaseLogic settings.

	Adjust these values to control the script.
	=============================================
*/
/*
	SETTING: settingTranspose

	DESCRIPTION:
	Global transpose (in semitones)
*/
var settingTranspose = 0

/*
	SETTING: settingSpeed

	DESCRIPTION:
	Global speed (default is 1).
	Useful for speeding up/slowing down sequences by fractional amounts.
*/
var settingSpeed = 1

/*
	SETTING: settingHumanizeVelocity

	DESCRIPTION:
	Range to add a random velocity (+ or -) to each note to humanize playback
	MIDI velocity range is 0-127
*/
var settingHumanizeVelocity = 10

/*
	SETTING: settingHumanizeBeatPos

	DESCRIPTION:
	Range to randomly move the start of a note on by n% of a beat (.1 is 10% of a beat)
*/
var settingHumanizeBeatPos = .025

/*
	SETTING: settingMinVelocity, settingMaxVelocity

	DESCRIPTION:
	Clamping range (0-127 is default MIDI velocity range)
*/
var settingMinVelocity = 60
var settingMaxVelocity = 100

/*
	SETTING: settingIsVelocityClamped

	DESCRIPTION:
	If true, clamp all note velocities to specified range
*/
var settingIsVelocityClamped = false

/*
	SETTING: settingIsClampedVelocityNormalized

	DESCRIPTION:
	If true, the notes will be normalized and scaled to fit the clamp range
	Example: note velocity is 64, that's at 50% of the standard MIDI velocity range (0-127),
	The new velocity will be at 50% of the clamped range.
	If the range is 20-40, the velocity will be 30 (halfway).
	This is useful for keeping crescendos while clamping.
*/
var settingIsClampedVelocityNormalized = true

/*
	=============================================
	Logic properties.

	Used by Logic Scripter.
	=============================================
*/
var NeedsTimingInfo = true


/*
	=============================================
	Basic types.
	=============================================
*/
/*
	PhaseBeatDuration

	DESCRIPTION:
	Describes duration with the note length as a time value in beats (1 is 1 beat, .25 is a quarter beat, etc.)
*/ 
class PhaseBeatDuration {
	constructor(duration) {
		if (typeof duration == "number") {
			this.duration = duration
		}
		else if (typeof duration.duration == "function") {
			this.duration = duration.duration()
		}
	}
}

/*
	PhaseDenominatorDuration

	DESCRIPTION:
	Describes duration with the note denominator (1/8th note is 8, whole note is 1)
*/ 
class PhaseDenominatorDuration {
	constructor(durationDenominator) {
		this.durationDenominator = durationDenominator
	}

	duration() {
		return 1.0/this.durationDenominator*4.0
	}

	static newDenominatorDurations(values) {
		return values.map(function(value) {
			return new PhaseDenominatorDuration(value)
		})
	}
}

/*
	PhaseNoteLengthDuration

	DESCRIPTION:
	Describes duration with a string:

	FORMAT:
	Denominator: /4 (quarter note)
	Triplets: 4t
	Dotted: 4d
*/ 
class PhaseNoteLengthDuration {
	constructor(durationString) {
		this.durationString = durationString
	}

	duration() {
		var durationString = this.durationString

		if (typeof durationString != "string") {
			console.log("Error: Note length in wrong format")
			console.log(durationString)
			return 0
		}

		if (durationString.startsWith("/")) {
			var denominatorString = durationString.substr(1, durationString.length-1)
			return this.durationForDenominatorString(denominatorString)
		} else if (durationString.toLowerCase().endsWith("d")) {
			var denominatorString = durationString.substring(0, durationString.length-1)
			return this.durationForDenominatorString(denominatorString)*1.5
		} else if (durationString.toLowerCase().endsWith("t")) {
			var denominatorString = durationString.substring(0, durationString.length-1)
			return this.durationForDenominatorString(denominatorString)*2.0/3.0
		}

		return 0
	}

	durationForDenominatorString(denominatorString) {
		var denominator = parseInt(denominatorString)
		if (typeof denominator == "number") {
			var denominatorDuration = new PhaseDenominatorDuration(denominator)
			return denominatorDuration.duration()
		} else {
			return 0
		}
	}
}


/*
	=============================================
	Score types

	General score types for use
	=============================================
*/
/*
	PhaseScoreElement

	DESCRIPTION:
	Base class for elements that can be placed in a score.
*/
class PhaseScoreElement {

}

/*
	PhaseScoreNote

	DESCRIPTION:
	A note in a score has pitch, duration, velocity
*/
class PhaseScoreNote extends PhaseScoreElement {
	constructor(pitch, duration, velocity) {
		super()
		this.pitch = pitch
		this.duration = duration
		this.velocity = velocity
	}

	midiEventsFromNoteOn(noteOn) {
		if (!(noteOn instanceof NoteOn)) {
			return noteOn
		}

		var result = new NoteOn(noteOn)
		result.pitch += this.pitch

		return [result]
	}
}

/*
	PhaseScoreRest

	DESCRIPTION:
	A rest in a score has duration
*/
class PhaseScoreRest extends PhaseScoreElement {
	constructor(duration) {
		super()
		this.duration = duration
	}
}


/*
	=============================================
	MIDI types

	Types used for MIDI events
	=============================================
*/

/*
	PhaseMIDINote

	DESCRIPTION:
	Standard MIDI note values
*/
const PhaseMIDINote = {
	C3: 60
}

/*
	=============================================
	Chord types

	Types used to play chords in a sequence
	=============================================
*/
/*
	PhaseChordType (enum)

	DESCRIPTION:
	Types of chords, along with their string notation.

	FUTURE: support more chord types as needed.
*/
const PhaseChordType = {
	major: "maj",
	minor: "min",
	diminished: "dim",
	major7: "maj7",
	dominant7: "dom7",
	minor7: "min7",
	suspended2: "sus2",
	suspended4: "sus4",
	augmented: "aug"
}

/*
	chordPitches (enum)

	DESCRIPTION:
	Pitches relative to root for each chord type.

	FUTURE: support more chord types as needed.
*/
const chordPitches = new Map([
	[PhaseChordType.major, [0, 4, 7]],
	[PhaseChordType.diminished, [0, 3, 6]],
	[PhaseChordType.major7, [0, 4, 7, 11]],
	[PhaseChordType.dominant7, [0, 4, 7, 10]],
	[PhaseChordType.minor, [0, 3, 7]],
	[PhaseChordType.minor7, [0, 3, 7, 10]],
	[PhaseChordType.suspended2, [0, 2, 7]],
	[PhaseChordType.suspended4, [0, 5, 7]],
	[PhaseChordType.augmented, [0, 4, 8]]
])

/*
	PhaseScoreChord

	DESCRIPTION:
	A chord in a score has pitch offsets from the root note played
*/
class PhaseScoreChord extends PhaseScoreElement {
	constructor(pitches) {
		super()
		this.pitches = pitches	// Offset from root pitch
	}

	midiEventsFromNoteOn(noteOn) {
		if (!(noteOn instanceof NoteOn)) {
			return noteOn
		}

		var events = new Array()
		this.pitches.forEach(function(chordPitch) {
			let event = new NoteOn(noteOn)
			event.pitch += chordPitch
			events.push(event)
		})
		return events
	}

	static newChord(chordType, rootPitch) {
		var pitches = chordPitches.get(chordType)
		if (pitches instanceof Array) {
			let chordPitches = pitches.map(pitch => rootPitch + pitch)
			return new PhaseScoreChord(chordPitches)
		}
		
		return undefined
	}
}


/*
	=============================================
	Sequence types

	Types for creating sequences & arpeggios
	=============================================
*/

/*
	PhaseSequence

	DESCRIPTION:
	A sequence of score elements (notes, rests, chords)
*/
class PhaseSequence {
	constructor(durations)  {
		this.steps = durations.map(duration => new PhaseScoreNote(0, duration, 100))
	}
}


/*
	=============================================
	Phase Utility Functions

	Some useful utilities
	=============================================
*/
var Phase = {
	randomDelta(range) {
		if (range <= 0) { return 0 }

		var delta = Math.random()*range
		if (Math.random() > 0.5) {
			return delta
		}
		
		return -delta
	}
}


/*
	=============================================
	Logic Scripter API

	Entrypoints for Logic Scripter API
	=============================================
*/
function HandleMIDI(event) {
	var info = GetTimingInfo()
	var sequence = null

	// Denominator sequence (simple)
	if (typeof sequenceDenominators !== "undefined") {
		patternDurations = PhaseDenominatorDuration.newDenominatorDurations(sequenceDenominators)
		sequence = new PhaseSequence(patternDurations)
	}

	if (typeof sequence !== "undefined" && sequence instanceof PhaseSequence) {
		if (typeof sequenceChords !== "undefined" && sequenceChords.length > 0) {
			sequence.steps = sequence.steps.map(function(step, index) {
				let arrayIndex = index % sequenceChords.length
				let chord = PhaseScoreChord.newChord(sequenceChords[arrayIndex], 0)

				chord.duration = 1
				if (typeof step.duration !== "undefined") {
					chord.duration = step.duration
				}

				return chord
			})
		}

		if (event instanceof NoteOn) {	
			let triggerEvent = event
			var beatPos = event.beatPos

			let localSequenceLength = sequenceLength
			if (localSequenceLength <= 0) {
				localSequenceLength = sequence.steps.length
			}
			
			for (let index = 0; index < localSequenceLength; index++) {
				let step = sequence.steps[index % sequence.steps.length]
				
				// Get duration as number or function
				var stepDuration = 1
				if (typeof step.duration !== "undefined") {
					if (typeof step.duration == "number") {
						stepDuration = step.duration
					} else if (typeof step.duration.duration == "function") {
						stepDuration = step.duration.duration()
					}
				}

				// Adjust by global speed setting
				var speedFactor = 1.0/settingSpeed;
				stepDuration *= speedFactor;

				// Skip notes based on chances
				var shouldPlayNote = true
				if (typeof sequenceChances !== "undefined") {
					let stepChance = sequenceChances[index % sequenceChances.length]
					if (Math.random() > stepChance) {
						shouldPlayNote = false
					}
				}

				// Negative durations indicate a rest
				if (stepDuration > 0 && shouldPlayNote) {
					let eventDuration = stepDuration

					// Adjust note gate
					if (typeof sequenceGates !== "undefined") {
						let stepGate = sequenceGates[index % sequenceGates.length]
						eventDuration *= stepGate
					}

					let pitch = event.pitch + settingTranspose

					if (typeof sequencePitches !== "undefined") {
						let stepPitch = sequencePitches[index % sequencePitches.length]
						pitch += stepPitch
					}

					let noteOnEvents = new Array()
					if (typeof step.midiEventsFromNoteOn == "function") {
						let modifyEvent = new NoteOn(event)
						modifyEvent.pitch = pitch
						noteOnEvents = step.midiEventsFromNoteOn(modifyEvent)
					}

					noteOnEvents.forEach(function(noteOnEvent) {
						var newBeatPos = beatPos
						newBeatPos += Phase.randomDelta(settingHumanizeBeatPos)

						// The beat position can never be before the original NoteOnEvent beatPos or it won't play
						noteOnEvent.beatPos = Math.max(newBeatPos, triggerEvent.beatPos)

						var velocity = noteOnEvent.velocity

						// Modify velocity based on step
						if (typeof sequenceVelocities !== "undefined") {
							let stepVelocity = sequenceVelocities[index % sequenceVelocities.length]
							velocity = stepVelocity
						}
	
						// Humanize velocity
						velocity += Phase.randomDelta(settingHumanizeVelocity)

						// Clamp velocity
						if (settingIsVelocityClamped) {
							var clampedVelocity = velocity
							clampedVelocity = Math.max(settingMinVelocity, velocity)
							clampedVelocity = Math.min(settingMaxVelocity, velocity)

							// Normalize clamped velocity (useful for crescendos)
							if (settingIsClampedVelocityNormalized) {
								var eventVelocity = MIDI.normalizeData(velocity)
								var eventVelocityNormal = eventVelocity/127.0
								clampedVelocity = settingMinVelocity + (settingMaxVelocity-settingMinVelocity)*eventVelocityNormal
							}

							velocity = clampedVelocity
						}

						// Send Midi CC events for sequence (pan, sustain, mod wheel, etc.)
						sequenceControlChannels.forEach(function(ccSteps, channel) {
							let stepCC = ccSteps[index % ccSteps.length]
							let channelChange = new ControlChange(noteOnEvent)
							channelChange.number = channel
							channelChange.value = stepCC
							channelChange.value = MIDI.normalizeData(channelChange.value)
				
							channelChange.send()
						})

						noteOnEvent.velocity = MIDI.normalizeData(velocity)
						noteOnEvent.send()

						let noteOffEvent = new NoteOff(noteOnEvent)
						noteOffEvent.beatPos += eventDuration
						noteOffEvent.send()
					})
				}
		
				beatPos += Math.abs(stepDuration)
			}
		}
	} else {
		event.send()
	}
}

/*
	PhaseLogicParameter

	DESCRIPTION:
	Parameter values for Logic
*/
const PhaseLogicParameter = {
	
	transpose: 0,
	sequenceLength: 1,
	speed: 2,
	humanizeBeatPos: 3,
	humanizeVelocity: 5,
	clampVelocity: 6,
	minVelocity: 7,
	maxVelocity: 8
}

function ParameterChanged(param, value) {

	switch (param) {
	case PhaseLogicParameter.transpose:
		settingTranspose = value
		break
	case PhaseLogicParameter.sequenceLength:
		sequenceLength = value
		break
	case PhaseLogicParameter.speed:
		settingSpeed = value/100
		break
	case PhaseLogicParameter.humanizeBeatPos:
		settingHumanizeBeatPos = value
		break
	case PhaseLogicParameter.humanizeVelocity:
		settingHumanizeVelocity = value
		break
	case PhaseLogicParameter.clampVelocity:
		settingIsVelocityClamped = value != 0
		break
	case PhaseLogicParameter.minVelocity:
		settingMinVelocity = value
		break
	case PhaseLogicParameter.maxVelocity:
		settingMaxVelocity = value
		break
	}
}

var PluginParameters = 
[
	{name: "Transpose", type: "lin", minValue: -63, maxValue: 63, numberOfSteps: 126, defaultValue: settingTranspose},
	{name: "Sequence Length", type: "lin", minValue: 0, maxValue: 12, numberOfSteps: 12, defaultValue: sequenceLength},
	{name: "Speed", type: "lin", unit: "%", minValue: 0, maxValue: 300, numberOfSteps: 300, defaultValue: settingSpeed*100},
	{name: "Humanize Beat Pos", type: "lin", minValue: 0, maxValue: .25, defaultValue: settingHumanizeBeatPos},
	{name: "Velocity Controls", type: "Text"},
	{name: "Humanize Velocity", type: "lin", minValue: 0, maxValue: 63, numberOfSteps: 63, defaultValue: settingHumanizeVelocity},
	{name: "Clamp Velocity", type: "menu", valueStrings: ["Off", "On"], numberOfSteps: 2, defaultValue:settingIsVelocityClamped ? 1 : 0},
	{name: "Min Velocity", type: "lin", minValue: 0, maxValue: 127, numberOfSteps: 127, defaultValue: settingMinVelocity},
	{name: "Max Velocity", type: "lin", minValue: 0, maxValue: 127, numberOfSteps: 127, defaultValue: settingMaxVelocity}
]


/*
	=============================================
	Private

	Used to debug code in Node.js. Ignore this if you're trying to modify the script for music.
	=============================================
*/
function private_main() {
	private.unitTests()
}

var private = {
	unitTests() {
		console.log("Running Unit Tests...")
		var denominatorDuration = new PhaseDenominatorDuration(4)
		assert(denominatorDuration.duration() == 1)

		var denominatorDuration = new PhaseDenominatorDuration(8)
		assert(denominatorDuration.duration() == .5)

		var noteLengthDuration = new PhaseNoteLengthDuration("/4")
		console.log(noteLengthDuration.duration())
		assert(noteLengthDuration.duration() == 1)

		var noteLengthDuration = new PhaseNoteLengthDuration("/8")
		console.log(noteLengthDuration.duration())
		assert(noteLengthDuration.duration() == .5)

		var noteLengthDuration = new PhaseNoteLengthDuration("4d")
		console.log(noteLengthDuration.duration())
		assert(noteLengthDuration.duration() == 1.5)

		var noteLengthDuration = new PhaseNoteLengthDuration("4D")
		console.log(noteLengthDuration.duration())
		assert(noteLengthDuration.duration() == 1.5)

		var noteLengthDuration = new PhaseNoteLengthDuration("4t")
		console.log(noteLengthDuration.duration())
		assert(noteLengthDuration.duration() == 1*2/3)
		
		var noteLengthDuration = new PhaseNoteLengthDuration("4T")
		console.log(noteLengthDuration.duration())
		assert(noteLengthDuration.duration() == 1*2/3)

		private.unitTests_chords()

		console.log("unitTests SUCCEEDED")
	},

	unitTests_chords() {
		var majorChord = PhaseScoreChord.newChord(PhaseChordType.major, 0)
		assert(majorChord.pitches[0] == 0)
		assert(majorChord.pitches[1] == 4)
		assert(majorChord.pitches[2] == 7)

		console.log("unitTests_chords SUCCEEDED")
	}
}

function assert(condition, message) {
    if (!condition) {
        throw message || "Assertion";
    }
}

private_main()


