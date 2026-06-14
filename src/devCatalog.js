// Developmental "experiments" catalog — play prompts matched to typical age
// windows (in weeks from birth). DESCRIPTIVE ranges only, not pass/fail and not
// diagnostic; huge normal variation. Initial scope: ~0–4 months.
//
// domain: 'motor' | 'social' | 'cognitive' | 'communication' | 'sensory'
// start/end: typical age window in weeks.

export const DOMAINS = {
  motor:         { label: 'Motor', icon: '🤸' },
  social:        { label: 'Social', icon: '😊' },
  cognitive:     { label: 'Cognitive', icon: '🧠' },
  communication: { label: 'Language', icon: '🗣️' },
  sensory:       { label: 'Sensory', icon: '👀' },
}

export const EXPERIMENTS = [
  {
    id: 'face_fixation', domain: 'sensory', title: 'Face fixation', start: 0, end: 6,
    how: 'Hold your face about 25–30 cm away in good light and stay still.',
    look_for: 'She locks onto your face and holds her gaze for a few seconds.',
  },
  {
    id: 'sound_orienting', domain: 'sensory', title: 'Orienting to sound', start: 0, end: 10,
    how: 'Talk softly or make a gentle sound off to one side, out of view.',
    look_for: 'She stills, changes expression, or turns toward the sound.',
  },
  {
    id: 'contrast_preference', domain: 'sensory', title: 'Contrast preference', start: 0, end: 8,
    how: 'Show a bold black-and-white pattern next to a plain grey card.',
    look_for: 'She looks noticeably longer at the high-contrast pattern.',
  },
  {
    id: 'rooting_sucking', domain: 'motor', title: 'Rooting reflex', start: 0, end: 16,
    how: 'Gently stroke the cheek near the corner of the mouth.',
    look_for: 'She turns toward the touch and roots/opens to suck (a newborn reflex).',
  },
  {
    id: 'palmar_grasp', domain: 'motor', title: 'Palmar grasp', start: 0, end: 12,
    how: 'Press a finger into the middle of her palm.',
    look_for: 'Her fingers curl and grip reflexively (fades around 3–4 months).',
  },
  {
    id: 'tummy_head_lift', domain: 'motor', title: 'Tummy-time head lift', start: 0, end: 8,
    how: 'Place her on her tummy on a firm surface for a short, supervised spell.',
    look_for: 'She briefly lifts her head; by ~2 months holds it up around 45°.',
  },
  {
    id: 'mutual_gaze', domain: 'social', title: 'Mutual gaze & calming', start: 0, end: 6,
    how: 'Hold her close, make eye contact and talk warmly.',
    look_for: 'She holds eye contact and settles or brightens to your voice.',
  },
  {
    id: 'horizontal_tracking', domain: 'sensory', title: 'Tracking side to side', start: 2, end: 10,
    how: 'Slowly move your face or a high-contrast object horizontally ~20 cm away.',
    look_for: 'Her eyes follow to the midline, then (later) smoothly past it.',
  },
  {
    id: 'social_smile', domain: 'social', title: 'Social smile', start: 5, end: 9,
    how: 'Smile, talk and make eye contact face-to-face when she is calm and alert.',
    look_for: 'A responsive smile back to your face/voice (not a sleepy/gas smile).',
  },
  {
    id: 'cooing', domain: 'communication', title: 'Cooing', start: 5, end: 10,
    how: 'Talk to her, then pause and leave space for a reply.',
    look_for: 'Vowel sounds ("ooh", "aah") and early back-and-forth turn-taking.',
  },
  {
    id: 'head_steady_upright', domain: 'motor', title: 'Head steady when upright', start: 6, end: 14,
    how: 'Hold her upright against your shoulder or supported sitting.',
    look_for: 'Her head bobs less and stays steadier on its own.',
  },
  {
    id: 'pushes_up_forearms', domain: 'motor', title: 'Push up on forearms', start: 8, end: 16,
    how: 'During tummy time, give her a moment to settle.',
    look_for: 'She props on her forearms and lifts her chest off the floor.',
  },
  {
    id: 'track_180', domain: 'sensory', title: 'Track across 180°', start: 8, end: 16,
    how: 'Move an interesting object slowly in a wide arc from one side to the other.',
    look_for: 'Her eyes (and head) follow all the way across.',
  },
  {
    id: 'hands_to_midline', domain: 'motor', title: 'Hands to midline', start: 10, end: 18,
    how: 'Lay her on her back and watch her hands at rest and at play.',
    look_for: 'She brings hands together over her chest and to her mouth.',
  },
  {
    id: 'laughs', domain: 'communication', title: 'Laughing', start: 12, end: 18,
    how: 'Play gently — funny faces, soft sounds, light tickles.',
    look_for: 'A real laugh or delighted squeal in response.',
  },
  {
    id: 'bats_at_toys', domain: 'motor', title: 'Bats at toys', start: 12, end: 20,
    how: 'Dangle a toy within arm’s reach above her chest.',
    look_for: 'She swipes or bats at it, gradually getting closer/contacting it.',
  },
]

export const EXPERIMENTS_BY_ID = Object.fromEntries(EXPERIMENTS.map(e => [e.id, e]))
