/* What Corporate Luck by Chance tells the shared new organizer flow (pack/zc-flow.js) about itself. The flow holds no game rules.
   Owner rule: hide what Luck cannot do (no coming soon, no demo stub): one entry per player (no ticket choice), no sample ticket, no number board, no claims, no Super Bumper, no rehearsal, no lucky draw, no next-number control, no pause. */
window.ZFLOW_GAME = {
  brand: "Corporate Luck by Chance",
  tickets: [1],
  bumper: false,
  idKind: true,               // the pack shows "Which ID?" (Employee ID | Email ID) in step 2 and saves the game setting idKind (emp | email): the same field Luck's own console and join page read
  sample: false, board: false, claims: false, handover: false,
  rehearsal: false, feed: false, presence: false, control: false, lucky: false,
  popular: [], recommended: [],
};
