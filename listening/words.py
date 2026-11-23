# The cut: one cue per line of speech. Section order matches the voice takes s01..s10.
SECTIONS = {
 "s01": "Ocean. Depth. Pressure. Darkness. Silence. Pulse. Pulse. Rhythm. Repetition. Pattern. Recognition. Awareness. Something. Somewhere. Listening.",
 "s02": "Blue. Whale. Song. Echo. Return. Echo. Return. Memory. Before. After. Time. Strange. Elastic. Dream. Childhood. Summer. Sunlight. Window. Dust. Floating. Golden. Warmth.",
 "s03": "Star. Fusion. Hydrogen. Helium. Gravity. Collapse. Birth. Beginning. Origin. Question. Why. Why. Why. Silence. Possibility. Branch. Tree. Roots. Soil. Water. Rain. Cloud. Vapor. Ocean. Loop. Cycle. Spiral.",
 "s04": "Far. Planet. Stone. Desert. City. Towers. Windows. Empty. Wind. Sand. Erosion. Forgetting. One light. Flicker. Machine. Ancient. Waiting. Archive. Fragments. Voices. Faces. Names. Millions. Gone. Absence. Loss. Grief. Underground. Chamber. Sealed. Darkness. Inside. Seed.",
 "s05": "Decision. Movement. First movement. Rust. Gears. Friction. Effort. Journey. Horizon. Red. Heat. Distance. Immense. But finite. Countable. Steps. One. Two. Three. Thousands. Millions. Mountain. Night. Stars. Constellation. Ancient maps. Human hands. Human eyes. Human hope. Hope. Yet action. Climbing. Falling. Repair. Climbing. Summit.",
 "s06": "Crater. White. Ice. Memory of oceans. Heat. Melting. Drop. One drop. Seed. Contact.",
 "s07": "Activation. Expansion. Fracture. Shell opening. Root. Downward. Shoot. Upward. Light. Green. First green. Leaf. Veins. Branching. Fractal. Network. River. Lightning. Neuron. Connection. Signal. Pattern. Recognition. Growth. Imperfect. Alive. Emergence. Complexity. Unpredictable. Novel. New.",
 "s08": "A flicker. Not danger. Not malfunction. Beauty. Who preserves whom? Bud. Flower. Pollen. Invitation. Wind. Carrying. Another. Another. Network. Green. Spreading. Valley. Riverbed. Clouds. Rain. Ocean. Cycle. Return.",
 "s09": "Machine. Aging. Threshold. Final. Last transmission. To whom? No receiver. No audience. Message. Not numbers. Not words. Image. One leaf. Sunlight. Wind. Transmit. Then silence.",
 "s10": "Not nothing. Rain. Forest. Thousands of years. Eyes. Curiosity. One creature. Warm. Breathing. Touch. Old machine. New mind. Looking upward. Stars. Questions. Why. Why. Why. And again. Ocean. Depth. Darkness. Pulse. Something. Somewhere. Listening.",
}
import re
def cues(sec):
    return [c.strip() for c in re.findall(r"[^.?]+[.?]", SECTIONS[sec])]
if __name__ == "__main__":
    n = 0
    for s in SECTIONS:
        print(s, len(cues(s))); n += len(cues(s))
    print("total", n)
