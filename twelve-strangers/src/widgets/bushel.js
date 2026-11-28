/* Exhibit: The Old Bailey, September 1670.
   A short branching game. The reader sits on the jury that tried the Quakers William Penn and William Mead.
   Stages: the case, the evidence and a first vote, two nights locked up (hold firm or give in), the final verdict,
   the fine (pay or sue out habeas corpus), and Bushel's Case. Seal: 'bushel'. */
(function () {
  'use strict';

  /* =====================================================================================
     FACTS AND COPY. Every factual statement in this exhibit lives here so it can be checked
     and corrected in one place. Dates are Old Style (the Julian calendar England used in 1670).
     The reader's own juror number and choices are the only invented parts.
     ===================================================================================== */
  var DATA = {
    days: [['Thu', '1 Sep'], ['Sat', '3 Sep'], ['Sun', '4 Sep'], ['Mon', '5 Sep'], ['Nov', '1670']],
    hungerWords: ['Fed', 'Peckish', 'Hungry', 'Very hungry', 'Starving'],
    docket: {
      court: 'Sessions House, Old Bailey',
      title: 'Rex v. Penn and Mead',
      rows: [
        ['Accused', 'William Penn and William Mead, Quakers'],
        ['Charge', 'Unlawful and tumultuous assembly, to the disturbance of the peace'],
        ['Where', 'Gracechurch Street, in the City of London'],
        ['When', 'Sunday 14 August 1670'],
        ['Bench', 'The Lord Mayor, Sir Samuel Starling, and the Recorder of London, Sir John Howel'],
        ['Juror', 'No. {juror}, one of twelve Londoners']
      ],
      story: 'Soldiers had padlocked the Quakers’ meeting house under the Conventicle Act 1670, which banned religious meetings outside the Church of England. So the Quakers gathered in the street, and Penn preached to them. He and Mead were arrested.',
      marginTitle: 'Margin note: the hats',
      margin: 'Quakers would not take off their hats for any man. Court officers pulled the hats off. The bench ordered them put back on. Then it fined Penn and Mead 40 marks each for wearing hats in court.',
      oldStyle: 'Dates are Old Style, the calendar England still used in 1670.',
      act: 'Take your seat'
    },
    evidence: {
      kicker: 'Saturday 3 September · The evidence',
      title: 'Three witnesses for the Crown',
      body: 'Call each witness to hear what they saw.',
      call: 'Witness',
      witnesses: [
        { who: 'A lieutenant sent to break up the meeting', said: 'He saw Penn speaking to the crowd. The noise was too great to make out the words.' },
        { who: 'A second witness', said: 'He saw Penn speaking too. There was such a noise that he could not tell what Penn said.' },
        { who: 'A third witness', said: 'He saw the crowd in the street. He could not say what was said to it.' }
      ],
      sum: 'So the Crown proved a crowd and a man speaking. Nobody could say what he said.',
      penn: 'Penn demanded to know what law he had broken. The common law, said the Recorder, and would not say which. If it is so common, Penn answered, it should not be hard to produce. For that he was shut in the bail-dock, a fenced pen at the far end of the court.',
      ballotQ: 'The Recorder sends the jury out to convict. How do you vote?',
      options: [
        { id: 'guilty', label: 'Guilty of unlawful assembly', sub: 'What the bench wants',
          reply: 'You side with the bench. So, at first, did most of the real jury: eight jurors leaned toward conviction and four held out. But a verdict had to be unanimous. To agree at all, the twelve settled on narrower words.' },
        { id: 'speaking', label: 'Guilty of speaking in Gracechurch Street', sub: 'Admit the facts, not the crime',
          reply: 'Those were the real jury’s words. Speaking in a street was no crime. The verdict admits what the witnesses saw and leaves out the crime the court wanted.' },
        { id: 'notguilty', label: 'Not guilty', sub: 'Penn broke no law',
          reply: 'You are with the holdouts. In the real jury room, eight jurors first leaned toward conviction and four did not. A verdict had to be unanimous, so the twelve agreed on a careful middle verdict.' }
      ],
      handUp: 'Hand up the verdict'
    },
    refused: {
      kicker: 'Saturday 3 September · Evening',
      title: 'The bench says no',
      body: 'Your foreman, Thomas Veer, stands and gives the verdict: guilty of speaking in Gracechurch Street. The bench will not take it. You are sent back out. You return with a written verdict: Penn guilty of speaking to an assembly in Gracechurch Street, and Mead not guilty. The bench refuses that too.',
      threatWho: 'The Recorder, Sir John Howel',
      threat: 'Gentlemen, you shall not be dismissed till we have a verdict that the court will accept; and you shall be locked up, without meat, drink, fire, and tobacco.',
      ban: ['Meat', 'Drink', 'Fire', 'Tobacco'],
      pennWho: 'William Penn, calling out to the jury',
      penn: 'You are Englishmen, mind your privilege, give not away your right.',
      prompt: 'The door is locked. What will you do?'
    },
    sunday: {
      kicker: 'Sunday 4 September',
      title: 'A second refusal',
      body: 'No breakfast. You are brought back into court and give the same verdict. The bench refuses it again and orders you locked up for a second night.',
      asides: [
        'The trial report records the jurors’ complaint that they had not been given so much as a chamber pot.',
        'At one point the Recorder told the court that England would never be well until it had something like the Spanish Inquisition.'
      ],
      prompt: 'Another night without food. What will you do?'
    },
    hold: 'Hold firm',
    holdHint: 'Press and hold. With a keyboard, press Enter.',
    keepHolding: 'Keep holding. Firmness takes a moment.',
    giveIn: 'Give in',
    nights: {
      1: { kicker: 'Saturday night', title: 'Locked in', body: 'No supper. No fire. No pipe. Twelve men in a bare room, waiting for morning.',
        firm: 'You hold firm. So did the real jury.',
        gave: 'You tell the foreman you will convict. It changes nothing: a verdict needs all twelve, and the real jury held firm. You are locked up with them all the same.' },
      2: { kicker: 'Sunday night', title: 'The second night', body: 'The room is colder. Nobody has eaten since Saturday.',
        firm: 'You hold firm again. So did the real jury.',
        firmFirst: 'This time you hold firm. So did the real jury.',
        gave: 'Hunger is a strong argument. The real jury did not give in. They spent a second night locked up, and so do you.' }
    },
    morning: 'Wait for morning',
    monday: {
      kicker: 'Monday 5 September',
      title: 'One more time',
      body: 'Two nights without meat, drink, fire or tobacco. The court asks for your verdict once more.',
      options: [
        { id: 'notguilty', label: 'Not guilty, both men', sub: 'Go further than before',
          reply: 'That is what the real jury said. The pressure had backfired. A jury that had offered a careful middle verdict on Saturday now acquitted both men outright.' },
        { id: 'guilty', label: 'Guilty, anything to go home', sub: 'Give the court what it wants',
          reply: 'One vote cannot make a verdict. The real jury, all twelve of them, answered: not guilty, for both men. The pressure had backfired.' }
      ],
      fine: 'The court fines every juror 40 marks, which is £26 13s 4d, and sends all twelve of you to Newgate prison until you pay. Penn and Mead go back to Newgate too, for the hat fines.',
      act: 'Go to Newgate'
    },
    newgate: {
      kicker: 'Newgate prison',
      title: 'Pay, or fight?',
      body: 'Forty marks is a heavy sum for a London tradesman. Pay, and you go home. Refuse, and you stay in jail while lawyers argue.',
      options: [
        { id: 'pay', label: 'Pay the 40 marks', sub: 'Go home to your family',
          reply: 'You pay and go home. So did eight of the real jurors. Four refused, led by Edward Bushel, and went to law without you.' },
        { id: 'refuse', label: 'Refuse, and sue out habeas corpus', sub: 'Make the court justify your jailing',
          reply: 'You stay, with Edward Bushel. Four of the twelve refuse to pay. Their lawyers go to the Court of Common Pleas for a writ of habeas corpus: an order to bring the prisoners into court and show by what right they are held.' }
      ],
      act: 'Hear the judgment'
    },
    ending: {
      kicker: 'Court of Common Pleas, November 1670',
      title: 'Bushel’s Case',
      holding: 'Chief Justice Sir John Vaughan ruled that jurors cannot be fined or imprisoned for their verdict. Bushel and his fellow jurors were set free.',
      why: 'His reasoning: the jury, not the judge, decides the facts. A judge cannot see through the jurors’ eyes. He cannot know what they knew or how they weighed it, so he cannot say they defied the evidence. Jurors could still be punished for real misconduct, such as taking a bribe.',
      plaqueCap: 'The tablet at the Central Criminal Court, the Old Bailey',
      plaque: 'Near this site William Penn and William Mead were tried in 1670 for preaching to an unlawful assembly in Gracechurch Street. This tablet commemorates the courage and endurance of the Jury, Thos Vere, Edward Bushell and ten others, who refused to give a verdict against them, although they were locked up without food for two nights, and were fined for their final Verdict of Not Guilty. The case of these Jurymen was reviewed on a writ of Habeas Corpus and Chief Justice Vaughan delivered the opinion of the Court, which established the Right of Juries to give their Verdict according to their convictions.',
      plaqueNote: 'The tablet honors the jury, not the famous defendants. It spells the names Vere and Bushell.',
      teachLabel: 'Why it matters',
      teach: 'This is a root of jury independence. Because jurors cannot be punished for their verdict, a jury can acquit even when the judge thinks the law requires a conviction. Americans later called that power jury nullification. American courts accept that juries have the power, but hold that jurors need not be told about it.',
      codaLabel: 'Postscript',
      coda: 'Twelve years later, Penn wrote laws for his new colony of Pennsylvania. They promised that all trials would be by twelve men, “as near as may be, peers or equals, and of the neighborhood.”',
      recordLabel: 'Your service record',
      again: 'Serve again'
    },
    art: {
      court: 'The court at the Old Bailey. The Lord Mayor and the Recorder sit at a raised bench under the arms of the City of London. Penn and Mead stand in the dock in their hats. You sit in the jury box with eleven others.',
      room: 'A bare room with a padlocked door, a cold hearth and an empty table. Twelve jurors sit around it. Through the barred window the sky is {sky}.',
      gate: 'The gate of Newgate prison. You stand behind the bars. A purse holds the 40 mark fine.'
    }
  };

  function fill(s, map) { return String(s).replace(/\{(\w+)\}/g, function (m, k) { return map[k] != null ? map[k] : m; }); }

  /* ---------- drawing: SVG strings, colored by .wb-* classes that use page tokens ---------- */
  function person(x, y, o) {
    o = o || {};
    var s = '<g class="wb-person' + (o.cls ? ' ' + o.cls : '') + '" transform="translate(' + x + ' ' + y + ')">';
    s += '<path class="wb-robe wb-' + (o.robe || 'ink') + '" d="M-9 22 Q-9 8 0 7 Q9 8 9 22 Z"/>';
    if (o.chain) s += '<path class="wb-chain" d="M-5 9 Q0 17 5 9"/><circle class="wb-chain-b" cx="0" cy="16" r="1.8"/>';
    if (o.wig) s += '<ellipse class="wb-wig" cx="-5.5" cy="2" rx="3.6" ry="6"/><ellipse class="wb-wig" cx="5.5" cy="2" rx="3.6" ry="6"/>';
    s += '<circle class="wb-face" cx="0" cy="0" r="5.5"/>';
    if (o.wig) s += '<path class="wb-wig" d="M-6 -1 Q-6 -7.5 0 -7.5 Q6 -7.5 6 -1 Q3 -4 0 -4 Q-3 -4 -6 -1 Z"/>';
    else if (o.hat) s += '<ellipse class="wb-hat" cx="0" cy="-4.5" rx="10" ry="2.2"/><path class="wb-hat" d="M-5 -4.5 V-10 Q0 -12 5 -10 V-4.5 Z"/>';
    else if (o.back) s += '<circle class="wb-hairback" cx="0" cy="0" r="5.5"/>';
    else s += '<path class="wb-hair" d="M-5.5 -1 A5.5 5.5 0 0 1 5.5 -1 Q0 -4 -5.5 -1 Z"/>';
    if (o.you) s += '<circle class="wb-you-ring" cx="0" cy="' + (o.back ? 0 : 0) + '" r="8.5"/>';
    return s + '</g>';
  }

  function artCourt() {
    var panels = '';
    for (var px = 16; px < 320; px += 32) panels += '<line class="wb-panel" x1="' + px + '" y1="0" x2="' + px + '" y2="150"/>';
    var bars = '';
    for (var bx = 10; bx <= 82; bx += 8) bars += '<line class="wb-rail" x1="' + bx + '" y1="140" x2="' + bx + '" y2="174"/>';
    var jurors = '';
    for (var i = 0; i < 6; i++) jurors += person(190 + i * 23, 123, { robe: ['acc', 'brass', 'ink', 'seal', 'acc', 'ink'][i] });
    var front = '';
    for (var j = 0; j < 6; j++) front += person(178 + j * 23, 138, { robe: ['ink', 'acc', 'brass', 'ink', 'seal', 'brass'][j], you: j === 2 });
    return '<svg viewBox="0 0 320 200" aria-hidden="true" focusable="false">' +
      '<rect class="wb-wall" x="0" y="0" width="320" height="200"/>' + panels +
      '<rect class="wb-floor" x="0" y="150" width="320" height="50"/><line class="wb-line" x1="0" y1="150" x2="320" y2="150"/>' +
      // arms of the City of London over the bench
      '<path class="wb-shield" d="M147 10 h26 v15 q0 12 -13 18 q-13 -6 -13 -18 z"/>' +
      '<path class="wb-cross" d="M160 11 V42 M148 21 H172"/><path class="wb-sword" d="M152 12.5 V19 M150 14.5 H154"/>' +
      // the bench
      person(78, 58, { robe: 'ink3' }) + person(116, 56, { robe: 'seal', chain: true }) + person(204, 56, { robe: 'ink', wig: true }) + person(242, 58, { robe: 'ink3' }) +
      '<rect class="wb-desk-top" x="54" y="74" width="212" height="6" rx="1"/><rect class="wb-desk" x="58" y="80" width="204" height="30"/>' +
      '<text class="wb-lbl" x="116" y="99" text-anchor="middle">Lord Mayor</text><text class="wb-lbl" x="204" y="99" text-anchor="middle">Recorder</text>' +
      // the verdict refused
      '<g class="wb-refused"><rect x="112" y="22" width="96" height="24" rx="2" transform="rotate(-6 160 34)"/><text x="160" y="39" text-anchor="middle" transform="rotate(-6 160 34)">REFUSED</text></g>' +
      // the dock
      person(25, 126, { robe: 'ink', hat: true }) + person(66, 126, { robe: 'ink', hat: true }) +
      '<rect class="wb-dock" x="6" y="140" width="80" height="34"/>' + bars + '<line class="wb-rail-top" x1="4" y1="140" x2="88" y2="140"/>' +
      '<text class="wb-lbl" x="25" y="188" text-anchor="middle">Penn</text><text class="wb-lbl" x="66" y="188" text-anchor="middle">Mead</text>' +
      // the witness
      '<g class="wb-witness">' + person(124, 128, { robe: 'brass' }) +
        '<g class="wb-bubble"><rect x="132" y="104" width="30" height="16" rx="4"/><path d="M136 120 l-3 6 l8 -6"/><circle cx="141" cy="112" r="1.6"/><circle cx="147" cy="112" r="1.6"/><circle cx="153" cy="112" r="1.6"/></g>' +
      '</g>' +
      '<rect class="wb-stand" x="110" y="142" width="28" height="32"/><text class="wb-lbl" x="124" y="188" text-anchor="middle">Witness</text>' +
      // the jury box
      jurors + front +
      '<rect class="wb-box" x="164" y="148" width="152" height="26"/>' +
      '<path class="wb-you-arrow" d="M224 187 v-8 M220.5 182.5 l3.5 -3.5 l3.5 3.5"/><text class="wb-you-lbl" x="224" y="196" text-anchor="middle">you</text>' +
      '<text class="wb-lbl" x="290" y="188" text-anchor="middle">Jury</text>' +
      '<g class="wb-verdict"><rect x="104" y="20" width="112" height="24" rx="2" transform="rotate(-4 160 32)"/><text x="160" y="36.5" text-anchor="middle" transform="rotate(-4 160 32)">NOT GUILTY</text></g>' +
      '</svg>';
  }

  function artRoom(nights) {
    var tally = '';
    for (var t = 0; t < 2; t++) tally += '<line class="wb-tally' + (t < nights ? ' is-on' : '') + '" data-tally="' + (t + 1) + '" x1="' + (106 + t * 7) + '" y1="34" x2="' + (104 + t * 7) + '" y2="54"/>';
    var back = '', front = '';
    for (var i = 0; i < 6; i++) back += person(128 + i * 22, 110, { robe: ['acc', 'brass', 'ink', 'seal', 'acc', 'ink'][i] });
    for (var j = 0; j < 6; j++) front += person(128 + j * 22, 152, { robe: ['ink', 'acc', 'brass', 'ink', 'seal', 'brass'][j], back: true, you: j === 3 });
    var boards = '';
    for (var b = 160; b < 200; b += 10) boards += '<line class="wb-board" x1="0" y1="' + b + '" x2="320" y2="' + b + '"/>';
    return '<svg viewBox="0 0 320 200" aria-hidden="true" focusable="false"' + (nights ? ' class="is-night"' : '') + '>' +
      '<rect class="wb-wall" x="0" y="0" width="320" height="200"/>' +
      '<rect class="wb-floor" x="0" y="150" width="320" height="50"/>' + boards + '<line class="wb-line" x1="0" y1="150" x2="320" y2="150"/>' +
      // a cold hearth under the window
      '<rect class="wb-mantel" x="16" y="96" width="76" height="6"/><path class="wb-hearth" d="M24 150 V108 Q54 98 84 108 V150 Z"/>' +
      '<path class="wb-ash" d="M34 150 q20 -10 40 0 z"/><path class="wb-log" d="M38 146 l28 -6 M44 140 l26 6"/>' +
      // the padlocked door
      '<rect class="wb-door" x="256" y="62" width="46" height="88"/><rect class="wb-band" x="256" y="76" width="46" height="4"/><rect class="wb-band" x="256" y="130" width="46" height="4"/>' +
      '<path class="wb-shackle" d="M255 98 v-6 a6 6 0 0 1 12 0 v6"/><rect class="wb-lock" x="252" y="97" width="18" height="15" rx="2"/><circle class="wb-keyhole" cx="261" cy="103.5" r="2"/><path class="wb-keyhole" d="M261 104 v4"/>' +
      // tally of nights, scratched on the wall
      tally +
      // the bare table and the twelve
      back + '<rect class="wb-table" x="110" y="126" width="132" height="8" rx="1"/><path class="wb-ln" d="M118 134 v16 M234 134 v16"/>' + front +
      '<text class="wb-you-lbl" x="194" y="182" text-anchor="middle">you</text>' +
      // night falls over the room; the window stays bright with the moon
      '<rect class="wb-dark" x="0" y="0" width="320" height="200"/>' +
      '<rect class="wb-sky" x="26" y="20" width="56" height="54"/>' +
      '<g class="wb-stars"><circle cx="36" cy="30" r="1.2"/><circle cx="50" cy="58" r="1"/><circle cx="72" cy="64" r="1.2"/><circle cx="40" cy="48" r="1"/></g>' +
      '<path class="wb-moon" d="M66 28 a10 10 0 1 0 10 14 a8 8 0 1 1 -10 -14 z"/>' +
      '<path class="wb-bars" d="M40 20 V74 M54 20 V74 M68 20 V74"/><rect class="wb-frame" x="26" y="20" width="56" height="54"/>' +
      '</svg>';
  }

  function artGate() {
    var stones = '';
    for (var r = 0; r < 7; r++) {
      var y = 14 + r * 22;
      stones += '<line class="wb-stone" x1="0" y1="' + y + '" x2="320" y2="' + y + '"/>';
      for (var x = (r % 2 ? 20 : 0); x < 320; x += 40) stones += '<line class="wb-stone" x1="' + x + '" y1="' + (y - 22) + '" x2="' + x + '" y2="' + y + '"/>';
    }
    var bars = '';
    for (var bx = 124; bx <= 196; bx += 12) bars += '<line x1="' + bx + '" y1="50" x2="' + bx + '" y2="170"/>';
    var coins = [0, 1, 2].map(function (i) { return '<circle class="wb-coin" data-coin="' + i + '" cx="' + (46 + i * 9) + '" cy="' + (126 - (i % 2) * 4) + '" r="5"/>'; }).join('');
    return '<svg viewBox="0 0 320 200" aria-hidden="true" focusable="false">' +
      '<rect class="wb-wall" x="0" y="0" width="320" height="200"/>' + stones +
      '<path class="wb-arch" d="M110 176 V70 Q160 22 210 70 V176 Z"/>' +
      person(160, 120, { robe: 'acc', you: true }) +
      '<clipPath id="wb-arch-clip"><path d="M110 176 V70 Q160 22 210 70 V176 Z"/></clipPath>' +
      '<g clip-path="url(#wb-arch-clip)"><g class="wb-portcullis">' + bars + '<line x1="112" y1="96" x2="208" y2="96"/><line x1="112" y1="140" x2="208" y2="140"/></g></g>' +
      '<path class="wb-arch-rim" d="M110 176 V70 Q160 22 210 70 V176"/>' +
      '<rect class="wb-sign" x="118" y="8" width="84" height="18" rx="2"/><text class="wb-sign-t" x="161" y="21.5" text-anchor="middle">NEWGATE</text>' +
      '<rect class="wb-ledge" x="20" y="140" width="72" height="8"/>' +
      '<g class="wb-purse-g"><path class="wb-purse" d="M42 140 q-12 -2 -10 -16 q2 -10 12 -12 h16 q10 2 12 12 q2 14 -10 16 z"/><path class="wb-ln" d="M44 112 q12 6 24 0"/>' + coins +
      '<text class="wb-lbl" x="56" y="162" text-anchor="middle">40 marks</text></g>' +
      '<g class="wb-writ"><rect class="wb-parch" x="230" y="70" width="70" height="88" rx="3"/>' +
        '<text class="wb-writ-t" x="265" y="91" text-anchor="middle">Habeas</text><text class="wb-writ-t" x="265" y="106" text-anchor="middle">corpus</text>' +
        '<path class="wb-lines" d="M240 117 h50 M240 125 h50 M240 133 h36"/><circle class="wb-wax" cx="282" cy="148" r="7"/></g>' +
      '<line class="wb-line" x1="0" y1="176" x2="320" y2="176"/>' +
      '</svg>';
  }

  var BAN_ICONS = {
    Meat: '<path class="wb-i-fill" d="M7 19 q-4 -9 5 -13 q9 -3 12 5 q2 8 -7 10 z"/><path class="wb-i-ln" d="M18 18 l5 5"/><circle class="wb-i-bone" cx="24" cy="24" r="2.2"/>',
    Drink: '<path class="wb-i-fill" d="M8 9 h12 v15 q0 3 -3 3 h-6 q-3 0 -3 -3 z"/><path class="wb-i-ln" d="M20 12 h3 q3 0 3 4 q0 4 -3 4 h-3"/><path class="wb-i-ln" d="M8 13 h12"/>',
    Fire: '<path class="wb-i-fill" d="M15 27 q-9 -2 -7 -11 q1 -5 5 -9 q0 5 3 7 q2 -4 1 -8 q8 6 6 14 q-2 6 -8 7 z"/>',
    Tobacco: '<path class="wb-i-ln" d="M4 20 L18 17"/><path class="wb-i-fill" d="M18 13 h8 v4 q0 6 -4 6 q-4 0 -4 -6 z"/><path class="wb-i-smoke" d="M22 10 q-2 -3 0 -5 q2 -2 0 -4"/>'
  };
  function banIcon(k) { return '<svg viewBox="0 0 30 30" aria-hidden="true" focusable="false">' + BAN_ICONS[k] + '<path class="wb-i-x" d="M3 27 L27 3"/></svg>'; }
  function moonIcon(on) { return '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false" class="' + (on ? 'is-on' : '') + '"><path d="M12 2.5 a8 8 0 1 0 6 12 a6.4 6.4 0 1 1 -6 -12 z"/></svg>'; }

  /* =====================================================================================
     WIDGET
     ===================================================================================== */
  TS.register('bushel', function (el, ctx) {
    var R = ctx.reduced;
    var juror = ctx.juror || '0000';
    var state;
    var acts = {};
    var timers = [];

    el.innerHTML =
      '<div class="w-bushel">' +
        '<div class="w-bushel-hud">' +
          '<ol class="w-bushel-days" aria-label="Court days">' + DATA.days.map(function (d, i) {
            return '<li data-day="' + i + '"><span>' + d[0] + '</span><b>' + d[1] + '</b></li>';
          }).join('') + '</ol>' +
          '<div class="w-bushel-meters">' +
            '<p class="w-bushel-meter"><span class="label">Nights locked up</span><span class="w-bushel-moons" data-moons></span><span class="sr-only" data-nights-sr></span></p>' +
            '<p class="w-bushel-meter"><span class="label">Hunger</span><span class="w-bushel-bar" aria-hidden="true"><i></i><i></i><i></i><i></i></span><span class="w-bushel-hword" data-hword></span></p>' +
          '</div>' +
        '</div>' +
        '<div class="w-bushel-art"></div>' +
        '<div class="w-bushel-step"></div>' +
        '<p class="sr-only" aria-live="polite"></p>' +
      '</div>';
    var root = el.firstChild;
    var artEl = root.querySelector('.w-bushel-art');
    var box = root.querySelector('.w-bushel-step');
    var live = root.querySelector('[aria-live]');
    var currentScene = null;

    function later(fn, ms) { var t = setTimeout(fn, R ? 0 : ms); timers.push(t); return t; }

    /* ---------- keeping the reader's place ----------
       After a tap, scroll only when what it revealed is off screen or under the sticky ticker, and never once the reader
       has started scrolling on their own. The page's html scroll-padding-top is the band the ticker covers (ticker plus
       12px). Positions are computed here rather than with scrollIntoView, because engines differ on whether that
       padding and an element's scroll-margin add up. */
    var lastUserScroll = 0;
    function userScrolled() { lastUserScroll = Date.now(); }
    window.addEventListener('wheel', userScrolled, { passive: true });
    window.addEventListener('touchmove', userScrolled, { passive: true });
    window.addEventListener('keydown', function (e) {
      if (/^(PageUp|PageDown|ArrowUp|ArrowDown|Home|End)$/.test(e.key) || (e.key === ' ' && !(e.target.closest && e.target.closest('button, input, textarea, select')))) userScrolled();
    });
    function coverH() {
      var p = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop);
      if (!(p > 0)) { var t = document.querySelector('.ticker'); p = t ? Math.max(0, t.getBoundingClientRect().bottom) + 12 : 0; }
      return p;
    }
    function goTo(y) {
      y = Math.max(0, Math.round(y));
      if (Math.abs(y - window.scrollY) < 2) return;
      try { window.scrollTo({ top: y, behavior: R ? 'auto' : 'smooth' }); } catch (e) { window.scrollTo(0, y); }
    }
    function toTop(el) { goTo(window.scrollY + el.getBoundingClientRect().top - coverH() - 4); }
    // show the run from a down to b with the least movement; when it cannot all fit, show its top
    function showRange(a, b) {
      if (!a || !a.getClientRects().length) return;
      if (!b || !b.getClientRects().length) b = a;
      var top = coverH() - 8, vh = window.innerHeight;
      var ta = a.getBoundingClientRect().top, bb = b.getBoundingClientRect().bottom;
      if (ta >= top && bb <= vh) return;
      if (ta < top || bb - ta > vh - top - 24) toTop(a);
      else goTo(window.scrollY + bb - vh + 16);
    }
    function clearTimers() { timers.forEach(clearTimeout); timers = []; }
    function say(msg) { live.textContent = ''; setTimeout(function () { live.textContent = msg; }, 40); }
    function svg() { return artEl.querySelector('svg'); }

    root.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]');
      if (!b || !root.contains(b) || b.disabled) return;
      var fn = acts[b.getAttribute('data-act')];
      if (fn) fn(b);
    });
    ctx.onVisible(function (v) { root.classList.toggle('is-paused', !v); });

    /* ---------- the HUD: days, nights, hunger ---------- */
    function hud(bump) {
      root.querySelectorAll('.w-bushel-days li').forEach(function (li) {
        var d = +li.getAttribute('data-day');
        li.classList.toggle('is-on', d === state.day);
        li.classList.toggle('is-past', d < state.day);
        if (d === state.day) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
      });
      root.querySelector('[data-moons]').innerHTML = moonIcon(state.nights >= 1) + moonIcon(state.nights >= 2);
      root.querySelector('[data-nights-sr]').textContent = state.nights + ' of 2';
      root.querySelectorAll('.w-bushel-bar i').forEach(function (seg, i) { seg.classList.toggle('is-on', i < state.hunger); });
      root.querySelector('[data-hword]').textContent = DATA.hungerWords[state.hunger];
      if (bump && !R) { var m = root.querySelector('.w-bushel-meters'); m.classList.remove('is-bump'); void m.offsetWidth; m.classList.add('is-bump'); }
    }

    /* ---------- the scene ---------- */
    var artFresh = false;
    function scene(name, opts) {
      opts = opts || {};
      if (name === currentScene && !opts.force) return svg();
      currentScene = name;
      artFresh = true;
      var html, label;
      if (name === 'court') { html = artCourt(); label = DATA.art.court; }
      else if (name === 'room') { html = artRoom(opts.nights || 0); label = fill(DATA.art.room, { sky: opts.nights ? 'dark' : 'still light' }); }
      else if (name === 'gate') { html = artGate(); label = DATA.art.gate; }
      else { html = opts.html; label = null; }
      artEl.innerHTML = html;
      artEl.className = 'w-bushel-art w-bushel-art-' + name;
      if (label) { artEl.setAttribute('role', 'img'); artEl.setAttribute('aria-label', label); }
      else { artEl.removeAttribute('role'); artEl.removeAttribute('aria-label'); }
      return svg();
    }
    function sceneClass(cls, on) { var s = svg(); if (s) s.classList.toggle(cls, on !== false); }

    /* ---------- one step of the story ---------- */
    function btnHtml(a) {
      if (a.hold) {
        return '<button type="button" class="btn w-bushel-hold" data-hold="' + a.act + '" aria-describedby="w-bushel-holdhint">' +
          '<span class="w-bushel-hold-fill" aria-hidden="true"></span><span class="w-bushel-hold-label">' + a.label + '</span></button>';
      }
      return '<button type="button" class="' + (a.cls || 'btn') + '" data-act="' + a.act + '"' + (a.disabled ? ' disabled' : '') + '>' + a.label + '</button>';
    }
    function step(o) {
      clearTimers();
      acts = {};
      (o.actions || []).forEach(function (a) { if (!a.hold) acts[a.act] = a.fn; });
      box.innerHTML =
        (o.kicker ? '<p class="w-bushel-kicker">' + o.kicker + '</p>' : '') +
        '<h4 class="w-bushel-h" data-focus>' + o.title + '</h4>' +
        (o.body ? '<p class="w-bushel-p">' + o.body + '</p>' : '') +
        (o.extra || '') +
        (o.actions && o.actions.length ? '<div class="btn-row w-bushel-actions">' + o.actions.map(btnHtml).join('') + '</div>' : '') +
        (o.after || '');
      (o.actions || []).forEach(function (a) { if (a.hold) holdButton(box.querySelector('[data-hold="' + a.act + '"]'), a.fn); });
      if (!R) { box.classList.remove('is-in'); void box.offsetWidth; box.classList.add('is-in'); }
      var hd = box.querySelector('[data-focus]');
      hd.setAttribute('tabindex', '-1');
      if (o.ready) o.ready();
      if (o.focus !== false && root.contains(document.activeElement)) { try { hd.focus({ preventScroll: true }); } catch (e) { hd.focus(); } }
      if (o.scroll !== false) reveal(o.art != null ? o.art : artFresh);
      artFresh = false;
      if (o.say) say(o.say);
    }
    /* A new step: bring its heading near the top, under the ticker. When the picture changed too, show the picture
       with the heading under it (and the calendar and meters as well, when the whole step then fits on screen). */
    function reveal(showArt) {
      var hd = box.querySelector('[data-focus]');
      var top = coverH() - 8, vh = window.innerHeight;
      var a = artEl.getBoundingClientRect(), b = box.getBoundingClientRect(), h = hd.getBoundingClientRect();
      var stacked = a.height > 0 && a.bottom <= b.top + 1;
      if (showArt && stacked) {
        var fits = b.bottom - root.getBoundingClientRect().top <= vh - top - 56;
        var el = fits ? root : artEl;
        if (el.getBoundingClientRect().top >= top && (fits ? b.bottom <= vh : h.bottom <= vh * 0.75)) return;
        toTop(el);
      } else {
        if (b.top >= top && h.top <= vh * 0.45) return;
        toTop(box);
      }
    }
    function setActions(list, focusFirst) {
      var row = box.querySelector('.w-bushel-actions');
      if (!row) { row = document.createElement('div'); row.className = 'btn-row w-bushel-actions'; box.appendChild(row); }
      list.forEach(function (a) { if (!a.hold) acts[a.act] = a.fn; });
      row.innerHTML = list.map(btnHtml).join('');
      list.forEach(function (a) { if (a.hold) holdButton(row.querySelector('[data-hold="' + a.act + '"]'), a.fn); });
      var first = row.querySelector('button:not([disabled])');
      if (focusFirst !== false && first && root.contains(document.activeElement)) first.focus({ preventScroll: true });
    }
    function quote(who, text, cls) {
      return '<blockquote class="w-bushel-quote' + (cls ? ' ' + cls : '') + '"><p>' + text + '</p><footer>' + who + '</footer></blockquote>';
    }

    /* press and hold: fills over 900ms; Enter or Space, or a click from assistive tech, acts at once */
    function holdButton(btn, done) {
      if (!btn) return;
      var holding = false, fired = false, t0 = 0, raf = 0, lastPointer = 0;
      function set(p) { btn.style.setProperty('--p', p.toFixed(3)); }
      function fire() {
        if (fired) return;
        fired = true; holding = false; set(1);
        btn.classList.remove('is-holding'); btn.classList.add('is-done');
        done();
      }
      function frame(t) {
        if (!holding) return;
        if (!t0) t0 = t;
        var p = Math.min(1, (t - t0) / 900);
        set(p);
        if (p >= 1) fire(); else raf = requestAnimationFrame(frame);
      }
      function start() {
        if (fired || btn.disabled) return;
        if (R) { fire(); return; }
        holding = true; t0 = 0;
        btn.classList.add('is-holding');
        raf = requestAnimationFrame(frame);
      }
      function stop() {
        if (!holding) return;
        holding = false;
        cancelAnimationFrame(raf);
        btn.classList.remove('is-holding');
        set(0);
        var hint = box.querySelector('.w-bushel-holdhint');
        if (hint) { hint.textContent = DATA.keepHolding; hint.classList.remove('is-nudge'); void hint.offsetWidth; hint.classList.add('is-nudge'); }
      }
      btn.addEventListener('pointerdown', function (e) {
        if (e.button && e.button !== 0) return;
        lastPointer = Date.now();
        e.preventDefault();
        try { btn.setPointerCapture(e.pointerId); } catch (err) {}
        btn.focus({ preventScroll: true });
        start();
      });
      btn.addEventListener('pointerup', function () { lastPointer = Date.now(); stop(); });
      btn.addEventListener('pointercancel', stop);
      btn.addEventListener('lostpointercapture', stop);
      btn.addEventListener('contextmenu', function (e) { e.preventDefault(); });
      btn.addEventListener('keydown', function (e) {
        if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) { e.preventDefault(); fire(); }
      });
      btn.addEventListener('click', function () { if (Date.now() - lastPointer > 600) fire(); });
    }

    /* a vote: one button per option, aria-pressed; the reply appears below and can change until confirmed */
    function ballot(options, name) {
      return '<div class="w-bushel-ballot" role="group" aria-label="' + name + '">' + options.map(function (op) {
        return '<button type="button" class="w-bushel-opt" data-act="vote" data-arg="' + op.id + '" aria-pressed="false">' +
          '<span class="w-bushel-box" aria-hidden="true"><svg viewBox="0 0 20 20"><path d="M4 4 L16 16 M16 4 L4 16"/></svg></span>' +
          '<span class="w-bushel-opt-text"><span class="w-bushel-opt-label">' + op.label + '</span><span class="w-bushel-opt-sub">' + op.sub + '</span></span></button>';
      }).join('') + '</div><div class="w-bushel-reply" hidden></div>';
    }
    function wireBallot(options, onPick) {
      acts.vote = function (b) {
        var id = b.getAttribute('data-arg');
        var op = options.filter(function (o) { return o.id === id; })[0];
        box.querySelectorAll('.w-bushel-opt').forEach(function (o) { o.setAttribute('aria-pressed', String(o === b)); });
        var rep = box.querySelector('.w-bushel-reply');
        rep.hidden = false;
        rep.innerHTML = '<p>' + op.reply + '</p>';
        if (!R) { rep.classList.remove('is-in'); void rep.offsetWidth; rep.classList.add('is-in'); }
        say(op.label + '. ' + op.reply);
        onPick(id, op);
      };
    }

    /* ---------- stage: the case ---------- */
    function stageCase(replay) {
      state = { day: 0, nights: 0, hunger: 0, heard: 0, vote: null, firm: 0, final: null, paid: null };
      hud(false);
      scene('court', { force: true });
      var D = DATA.docket;
      var rows = D.rows.map(function (r) { return '<div><dt>' + r[0] + '</dt><dd>' + fill(r[1], { juror: juror }) + '</dd></div>'; }).join('');
      step({ title: D.title, scroll: !!replay, focus: !!replay,
        kicker: D.court,
        extra: '<dl class="w-bushel-docket">' + rows + '</dl>' +
          '<p class="w-bushel-p">' + D.story + '</p>' +
          '<aside class="w-bushel-margin"><p class="label">' + D.marginTitle + '</p><p>' + D.margin + '</p></aside>' +
          '<p class="w-bushel-fine">' + D.oldStyle + '</p>',
        actions: [{ label: D.act, act: 'seat', fn: stageEvidence }] });
    }

    /* ---------- stage: the evidence and the first vote ---------- */
    function stageEvidence() {
      var E = DATA.evidence;
      state.day = 1; state.heard = 0;
      hud(true);
      scene('court');
      var calls = E.witnesses.map(function (w, i) {
        return '<button type="button" class="w-bushel-call" data-act="call" data-arg="' + i + '" aria-expanded="false">' +
          '<span class="w-bushel-call-n">' + E.call + ' ' + (i + 1) + '</span><span class="w-bushel-call-who">' + w.who + '</span>' +
          '<span class="w-bushel-call-said" hidden>' + w.said + '</span></button>';
      }).join('');
      step({ kicker: E.kicker, title: E.title, body: E.body,
        extra: '<div class="w-bushel-calls">' + calls + '</div><div class="w-bushel-after" hidden></div>',
        say: E.title });
      acts.call = function (b) {
        if (b.getAttribute('aria-expanded') === 'true') return;
        b.setAttribute('aria-expanded', 'true');
        b.classList.add('is-heard');
        b.querySelector('.w-bushel-call-said').hidden = false;
        showRange(b);
        sceneClass('is-witness', false);
        void artEl.offsetWidth;
        sceneClass('is-witness', true);
        state.heard++;
        say(b.querySelector('.w-bushel-call-said').textContent);
        if (state.heard === E.witnesses.length) {
          var t0 = Date.now();
          later(function () { showBallot(); if (lastUserScroll <= t0) showRange(box.querySelector('.w-bushel-after .w-bushel-p')); }, 350);
        }
      };
      function showBallot() {
        var after = box.querySelector('.w-bushel-after');
        after.hidden = false;
        after.innerHTML = '<p class="w-bushel-p"><b>' + E.sum + '</b></p>' +
          '<aside class="w-bushel-margin"><p>' + E.penn + '</p></aside>' +
          '<p class="w-bushel-q">' + E.ballotQ + '</p>' + ballot(E.options, 'Your first vote') +
          '<div class="btn-row w-bushel-actions"></div>';
        if (!R) { after.classList.remove('is-in'); void after.offsetWidth; after.classList.add('is-in'); }
        wireBallot(E.options, function (id) {
          state.vote = id;
          setActions([{ label: E.handUp, act: 'handup', cls: 'btn btn-seal', fn: stageRefused }], false);
          showRange(box.querySelector('.w-bushel-reply'), box.querySelector('.w-bushel-actions'));
        });
        var first = after.querySelector('.w-bushel-opt');
        if (first && root.contains(document.activeElement)) first.focus({ preventScroll: true });
      }
    }

    /* ---------- stage: refused, and locked up ---------- */
    function banList() {
      return '<ul class="w-bushel-ban" aria-label="Without meat, drink, fire and tobacco">' + DATA.refused.ban.map(function (k, i) {
        return '<li style="--d:' + (i * 90) + 'ms">' + banIcon(k) + '<span>' + k + '</span></li>';
      }).join('') + '</ul>';
    }
    function firmChoice(n, onFirm, onGive) {
      return [
        { label: DATA.hold, act: 'firm' + n, hold: true, fn: function () { state.firm++; onFirm(); } },
        { label: DATA.giveIn, act: 'give' + n, cls: 'btn btn-ghost', fn: onGive }
      ];
    }
    function stageRefused() {
      var S = DATA.refused;
      state.hunger = 1;
      hud(true);
      scene('court');
      sceneClass('is-witness', false);
      sceneClass('is-refused', true);
      step({ kicker: S.kicker, title: S.title, body: S.body, art: true,
        extra: quote(S.threatWho, S.threat, 'is-bench') + banList() + quote(S.pennWho, S.penn, 'is-penn') +
          '<p class="w-bushel-q">' + S.prompt + '</p>',
        after: '<p class="w-bushel-holdhint" id="w-bushel-holdhint">' + DATA.holdHint + '</p>',
        actions: firmChoice(1, function () { nightCard(1, true); }, function () { nightCard(1, false); }),
        say: S.title + '. ' + S.threat });
    }

    function nightCard(n, firm) {
      var N = DATA.nights[n];
      var t0 = Date.now();
      // night 2: 'again' only if the reader also held firm on night 1 (state.firm already counts tonight)
      var lead = !firm ? N.gave : (n === 2 && state.firm < 2 && N.firmFirst ? N.firmFirst : N.firm);
      state.nights = n - 1;
      scene('room', { force: true, nights: n - 1 });
      step({ kicker: N.kicker, title: N.title, body: lead + ' ' + N.body,
        actions: [{ label: DATA.morning, act: 'morning', disabled: true, fn: n === 1 ? stageSunday : stageMonday }],
        say: lead + ' ' + N.body });
      // the sky darkens, a mark goes on the wall, the stomach complains
      later(function () {
        var s = svg();
        s.classList.add('is-night');
        artEl.setAttribute('aria-label', fill(DATA.art.room, { sky: 'dark' }));
        later(function () {
          var mark = s.querySelector('[data-tally="' + n + '"]');
          if (mark) mark.classList.add('is-on');
          state.nights = n;
          state.hunger = Math.min(4, state.hunger + 1);
          hud(true);
          later(function () {
            var b = box.querySelector('[data-act="morning"]');
            if (b) {
              b.disabled = false;
              if (root.contains(document.activeElement)) b.focus({ preventScroll: true });
              if (lastUserScroll <= t0) showRange(b);
            }
          }, 250);
        }, 520);
      }, 80);
    }

    /* ---------- stage: Sunday ---------- */
    function stageSunday() {
      var S = DATA.sunday;
      state.day = 2;
      state.hunger = Math.min(4, state.hunger + 1);
      hud(true);
      scene('court', { force: true });
      sceneClass('is-refused', true);
      step({ kicker: S.kicker, title: S.title, body: S.body,
        extra: S.asides.map(function (a) { return '<aside class="w-bushel-margin"><p>' + a + '</p></aside>'; }).join('') +
          '<p class="w-bushel-q">' + S.prompt + '</p>',
        after: '<p class="w-bushel-holdhint" id="w-bushel-holdhint">' + DATA.holdHint + '</p>',
        actions: firmChoice(2, function () { nightCard(2, true); }, function () { nightCard(2, false); }),
        say: S.title + '. ' + S.body });
    }

    /* ---------- stage: Monday ---------- */
    function stageMonday() {
      var M = DATA.monday;
      state.day = 3;
      hud(true);
      scene('court', { force: true });
      step({ kicker: M.kicker, title: M.title, body: M.body,
        extra: ballot(M.options, 'Your final vote') + '<div class="w-bushel-finebox" hidden></div>',
        say: M.title + '. ' + M.body });
      wireBallot(M.options, function (id) {
        var t0 = Date.now();
        state.final = id;
        sceneClass('is-refused', false);
        sceneClass('is-verdict', true);
        box.querySelectorAll('.w-bushel-opt').forEach(function (o) { o.disabled = true; });
        later(function () {
          var fb = box.querySelector('.w-bushel-finebox');
          fb.hidden = false;
          fb.innerHTML = '<p class="w-bushel-finestamp" aria-hidden="true">40 marks</p><p>' + M.fine + '</p>';
          if (!R) fb.classList.add('is-in');
          say(M.fine);
          setActions([{ label: M.act, act: 'newgate', fn: stageNewgate }]);
          if (lastUserScroll <= t0) showRange(box.querySelector('.w-bushel-reply'), box.querySelector('.w-bushel-actions'));
        }, 700);
      });
    }

    /* ---------- stage: Newgate ---------- */
    function stageNewgate() {
      var G = DATA.newgate;
      scene('gate', { force: true });
      step({ kicker: G.kicker, title: G.title, body: G.body,
        extra: ballot(G.options, 'Pay or refuse'),
        say: G.title + ' ' + G.body });
      wireBallot(G.options, function (id) {
        state.paid = id === 'pay';
        sceneClass('is-paid', state.paid);
        sceneClass('is-writ', !state.paid);
        box.querySelectorAll('.w-bushel-opt').forEach(function (o) { o.disabled = true; });
        setActions([{ label: G.act, act: 'judgment', cls: 'btn btn-seal', fn: stageEnding }]);
        var t0 = Date.now();
        later(function () { if (lastUserScroll <= t0) showRange(box.querySelector('.w-bushel-reply'), box.querySelector('.w-bushel-actions')); }, 500);
      });
    }

    /* ---------- the ending: Bushel's Case ---------- */
    // The tablet is tall. Two columns: it fills the picture column. One column (phones): it follows the holding,
    // so the heading and the holding come first, and the empty picture box hides (:empty in bushel.css).
    var wide = window.matchMedia ? window.matchMedia('(min-width: 46rem)') : null;
    function placePlaque() {
      var fig = root.querySelector('.w-bushel-plaque'), slot = box.querySelector('[data-plaque-slot]');
      if (!fig || !slot) return;
      var dest = wide && wide.matches ? artEl : slot;
      if (fig.parentNode !== dest) dest.appendChild(fig);
    }
    if (wide) {
      if (wide.addEventListener) wide.addEventListener('change', placePlaque);
      else if (wide.addListener) wide.addListener(placePlaque);
    }
    function stageEnding() {
      var E = DATA.ending;
      state.day = 4;
      state.hunger = 0;
      hud(false);
      scene('plaque', { force: true, html:
        '<figure class="w-bushel-plaque"><div class="w-bushel-plaque-in"><p>' + E.plaque + '</p></div>' +
        '<figcaption>' + E.plaqueCap + '</figcaption></figure>' });
      var finalWord = state.final === 'notguilty' ? 'Not guilty' : 'Guilty. The real jury said not guilty.';
      var record =
        '<div class="w-bushel-record">' +
          '<p class="label">' + E.recordLabel + '</p>' +
          '<span class="w-bushel-record-stamp" aria-hidden="true">' + (state.paid ? 'Fine paid' : 'Discharged') + '</span>' +
          '<dl>' +
            '<div><dt>Juror</dt><dd>No. ' + juror + '</dd></div>' +
            '<div><dt>Held firm</dt><dd>' + state.firm + ' of 2 nights</dd></div>' +
            '<div><dt>Final vote</dt><dd>' + finalWord + '</dd></div>' +
            '<div><dt>Fine</dt><dd>' + (state.paid ? 'Paid, 40 marks' : 'Refused. Freed by habeas corpus') + '</dd></div>' +
          '</dl>' +
        '</div>';
      step({ kicker: E.kicker, title: E.title, body: E.holding, ready: placePlaque,
        extra: '<p class="w-bushel-p">' + E.why + '</p>' +
          '<div class="w-bushel-plaque-slot" data-plaque-slot></div>' +
          '<p class="w-bushel-fine">' + E.plaqueNote + '</p>' +
          '<div class="w-bushel-teach"><p class="label">' + E.teachLabel + '</p><p>' + E.teach + '</p></div>' +
          record +
          '<div class="w-bushel-coda"><p class="label">' + E.codaLabel + '</p><p>' + E.coda + '</p></div>',
        actions: [{ label: E.again, act: 'again', cls: 'btn btn-ghost', fn: function () { stageCase(true); } }],
        say: E.title + '. ' + E.holding });
      later(function () { ctx.stamp('bushel'); }, 600);
    }

    stageCase();
  });
})();
