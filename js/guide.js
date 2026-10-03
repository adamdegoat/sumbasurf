// The Surf Guide in the villa (his call 3 Oct 2026: 'a tutorial guide in the villa, how to land tricks, accurate to what
// they can do, no exact scoring, simple English, cool sounding'). Content only: the page that shows it is in game.js
// (openGuide). To add a move later, add a line to a section; to add a board or topic, add a section. Nothing else changes.
//
// Words in {braces} become the right control for the player's device:
//   {PADDLE} {PUMP} {STALL} {WALK} {SWITCH} {TOWIN}   the buttons (on a computer: the keys)
//   {STEER}  how to carve        {HARD}  steering all the way over        {BOTH}  STALL and hard steer together
// Every line was checked against how the game reads your input (surf.js / game.js, 3 Oct 2026), and the test pro landed
// the moves this way. Keep it that way: nothing goes in here that the game can't actually do.
export const GUIDE_WORDS = {
  phone: { PADDLE: 'PADDLE', PUMP: 'PUMP', STALL: 'STALL', WALK: 'WALK', SWITCH: 'SWITCH', TOWIN: 'TOW IN',
    STEER: 'Slide your thumb left and right', HARD: 'push your thumb all the way', BOTH: 'Hold STALL and push your thumb all the way' },
  desk: { PADDLE: 'Space', PUMP: 'Space', STALL: 'Shift', WALK: 'Space', SWITCH: 'X', TOWIN: 'T',
    STEER: 'Use the left and right arrows', HARD: 'hold an arrow', BOTH: 'Hold Shift and an arrow' },
};
export const GUIDE = [
  { id: 'basics', title: 'Basics', tag: 'Start here', items: [
    ['Catch a wave', 'Face the beach. Hold {PADDLE} as the wave lifts you. You stand up on your own.'],
    ['Ride it', 'Go left or right along the wave. Never straight down.'],
    ['Carve', '{STEER}. More turn, harder carve.'],
    ['Speed', 'Hold {PUMP} and weave up and down the wave.'],
    ['Stall', 'Hold {STALL} to slow down and let the wave catch you.'],
    ['Bottom turn', 'Drop to the bottom, then turn back up. Best moves start here.'],
    ['Score big', 'Hard moves, near the breaking part, one after another. Don\'t fall.'],
  ] },
  { id: 'short', title: 'Shortboard and Fish', tag: 'The trick boards', items: [
    ['Snap', 'Race up to the top. Turn hard back down.'],
    ['Tail slide', 'Snap, and press {STALL} at the top. Let go to grip again.'],
    ['Cutback', 'Turn all the way back toward the breaking wave, then go again.'],
    ['Roundhouse', 'A cutback that bounces off the whitewater.'],
    ['Floater', 'Fly over the breaking part, then drop back onto the wave.'],
    ['Air', 'Race up into the lip. The wave throws you up.'],
    ['Grab', 'In the air, hold {STALL}.'],
    ['Air 360', 'In the air, {HARD}. Spin right round.'],
    ['Air reverse', 'Spin half way, land backwards, keep steering to come round.'],
  ] },
  { id: 'gun', title: 'Gun', tag: 'For big waves', items: [
    ['Late drop', 'Take off right at the peak and make it down.'],
    ['Big waves', 'At the bottom, turn along the wave. Straight down and the chop throws you.'],
    ['Tow-in', 'At Ombak Raksasa, tap {TOWIN}. The jet ski takes you in.'],
  ] },
  { id: 'long', title: 'Longboard', tag: 'All style', items: [
    ['Walk', 'Hold {WALK} to walk to the front. Let go to walk back.'],
    ['Hang five', 'Toes of one foot over the front.'],
    ['Hang ten', 'Both feet over the front. Stay near the breaking part.'],
    ['Switch', 'Tap {SWITCH} to swap your feet.'],
  ] },
  { id: 'alaia', title: 'Alaia', tag: 'No fins, all fun', items: [
    ['Slide', 'Turn hard and the back slides out. Ease off to grip again.'],
  ] },
  { id: 'body', title: 'Bodyboard', tag: 'Ride it lying down', items: [
    ['Arm drag', 'Hold {STALL} to slow right down.'],
    ['Spinner', '{BOTH}. Spin a full circle.'],
    ['El rollo', 'Air off the lip, then hold {STALL}. Roll right over.'],
    ['ARS', 'El rollo plus a full spin. The hardest move in the game.'],
  ] },
  { id: 'barrel', title: 'Barrels', tag: 'Get covered', items: [
    ['Get in', 'Stay low as the wave curls over. Hold {STALL}.'],
    ['Stay in', 'Let go of {STALL} and {PUMP} to keep up.'],
    ['Get out', 'Race for the light before it closes.'],
  ] },
];
export const guideText = (s, desk) => s.replace(/\{(\w+)\}/g, (m, k) => (desk ? GUIDE_WORDS.desk : GUIDE_WORDS.phone)[k] ?? m);
