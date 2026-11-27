/* Exhibit: Accused, 1200.
   A short branching game. The reader is a free villager accused of stealing a neighbor's cow in King John's England,
   before 1215, and tries each of the ways guilt could be decided: hot iron, cold water, battle, oath-helpers, or a
   purchased inquest of neighbors. Every path ends at the Fourth Lateran Council (1215). Seal: 'ordeal'. */
(function () {
  'use strict';

  /* =====================================================================================
     FACTS AND COPY. Every factual statement in this exhibit lives in this object so it can be checked
     and corrected in one place. Characters (Walter, Bramble, the neighbors) are invented.
     ===================================================================================== */
  var DATA = {
    sheet: {
      court: 'Pleas of the Crown',
      when: 'England, about 1200',
      reign: 'King John is on the throne. Magna Carta is fifteen years away.',
      rows: [
        ['Accused', 'Juror No. {juror}, a free villager'],
        ['Charge', 'Stealing a red cow named Bramble from your neighbor, Walter atte Brook'],
        ['Found', 'In your barn, eating your hay'],
        ['Your story', 'The fence by the brook is down. Bramble wanders.']
      ],
      art: 'A red cow stands in the doorway of your barn, chewing hay. Your neighbor Walter points at her and shouts. Behind him, a fence by the brook has fallen down.'
    },
    repQ: 'What does the village say about you?',
    reps: {
      good: { label: 'Good name', gloss: 'You pay your tithe and help with the harvest. People trust you.' },
      mid: { label: 'So-so', gloss: 'You owe the miller two shillings and you argue with the reeve.' },
      bad: { label: 'Bad name', gloss: 'Bramble is the third cow to wander into your barn this year.' }
    },
    chooseTitle: 'Choose your trial',
    chooseNote: 'In 1200 you rarely got to choose. Your rank, your accuser and the court decided for you. Here you may try them all, one at a time.',
    order: ['iron', 'water', 'battle', 'oath', 'inquest'],
    paths: {
      iron: {
        title: 'Ordeal of hot iron',
        line: 'Carry red-hot iron nine feet. Three days later, the priest reads your hand.',
        tag: 'Glanvill: for free men',
        steps: [
          { title: 'The priest blesses the iron',
            body: 'Mass is said and the iron is pulled from the fire. You must carry it nine of your own feet, to the mark where the priest stands.',
            hold: 'Hold to carry', holdHint: 'Press and hold to walk, or tap once for each pace.',
            art: 'A church floor. A brazier glows on the left. You stand at the start of a nine foot course, holding a red-hot bar. A priest waits at the far mark.' },
          { title: 'Bound and sealed',
            body: 'The priest wraps your burned hand in cloth and seals the binding with wax, so nobody can treat the wound or swap the bandage.',
            act: 'Bind and seal', wait: 'Wait three days',
            art: 'Your open hand, with a red burn across the palm. Three calendar tiles stand beside it.' },
          { title: 'The third day',
            body: 'The priest checks his seal and unwraps the cloth. A clean wound means God has cleared you. A wound that festers means guilt.',
            act: 'Break the seal' }
        ],
        pClean: 0.63, // Varad: 130 of 208 cleared, about 63 percent
        clean: { stamp: 'Cleared', tone: 'good', title: 'The wound is clean.',
          body: 'God has judged you innocent. Walter gets his cow back. You get your good name back.' },
        foul: { stamp: 'Convicted', tone: 'bad', title: 'The wound festers.',
          body: 'Guilty, in the eyes of God and the court. Theft of a cow was a felony, and felons could hang.' },
        record: 'At Várad in Hungary, a church register kept from 1208 to 1235 records 208 people who carried the hot iron. 130 of them, nearly two in three, were cleared. The economist Peter Leeson offers a theory: a guilty person who believed in the ordeal would confess or settle first, so the people who dared to carry the iron were mostly innocent, and a priest who let the iron cool or read the wound kindly could let them pass.'
      },
      water: {
        title: 'Ordeal of cold water',
        line: 'Bound and lowered into blessed water. Sink and you are innocent. Float and you are guilty.',
        tag: 'Glanvill: for peasants',
        steps: [
          { title: 'The water is blessed',
            body: 'The priest blesses the pond and asks it to receive the innocent and reject the guilty. Your hands are bound. A rope around your waist will haul you out. How do you go in?',
            full: 'Fill my lungs', empty: 'Breathe out',
            art: 'A pond below a wooden crane. You hang from a rope above the water, bound. A priest blesses the water from the bank. A dashed line under the surface marks how deep you must sink.' }
        ],
        pSink: { full: 0.35, empty: 0.8 },
        physics: 'Physics note: lungs full of air make a body float. With empty lungs, most people sink.',
        sink: { stamp: 'Cleared', tone: 'good', title: 'You sink.',
          body: 'The water has received you, so you are innocent. They haul you out, coughing, and you go home.' },
        sinkBad: { stamp: 'Exiled', tone: 'mid', title: 'You sink, and still you go.',
          body: 'The water cleared you, but the village calls you a thief. Under the Assize of Clarendon (1166), a man of very bad reputation who passed the water ordeal still had to leave the realm, crossing the sea within eight days.' },
        float: { stamp: 'Convicted', tone: 'bad', title: 'You float.',
          body: 'You bob on the surface like a cork. The water has rejected you. Under the Assize of Northampton (1176), a man who failed the water ordeal lost a foot and his right hand and had to leave the realm within forty days.' },
        record: 'Henry II’s Assize of Clarendon (1166) sent men accused by juries of their neighbors to the water. The lawbook called Glanvill, written in the late 1180s, says the hot iron was for free men and the water for peasants. The Assize of Clarendon also let reputation outweigh the ordeal, as you may have seen.'
      },
      battle: {
        title: 'Trial by battle',
        line: 'Walter accuses you himself, so you fight him in person. Last until the stars come out and you win.',
        tag: 'Only if a private accuser appeals you',
        steps: [
          { title: 'Walter appeals you',
            body: 'Walter swears you stole Bramble and offers to prove it with his body. In a criminal appeal there are no hired champions. You fight him yourself, with staves and shields, from sunrise. Hold out until the stars appear and you win.',
            act: 'Enter the lists',
            art: 'A fenced field at sunrise. You and Walter face each other with shields and staves while villagers watch from behind the rail.' }
        ],
        times: ['Sunrise', 'Midday', 'Afternoon', 'Dusk'],
        roundTitle: 'Walter comes at you',
        strike: 'Strike', guard: 'Guard',
        tips: 'Striking can end it early but leaves you open. Guarding is safer and slowly wears you down.',
        msgs: {
          hitHim: 'Your staff cracks against his shield arm. Walter staggers.',
          hitYou: 'His staff catches you in the ribs.',
          block: 'You take the blow on your shield. Your arm aches.'
        },
        stars: { stamp: 'Acquitted', tone: 'good', title: 'The stars come out.',
          body: 'You are still on your feet. You have held out, so God has cleared you. A defeated accuser owed the king a fine.' },
        craven: { stamp: 'Acquitted', tone: 'good', title: 'Walter cries craven.',
          body: 'Craven was the word of surrender, and saying it disgraced a man for life. You are cleared.' },
        lost: { stamp: 'Defeated', tone: 'bad', title: 'You cannot lift your staff.',
          body: 'Defeat means guilt. In a criminal appeal, the defeated accused was hanged.' },
        record: 'Trial by battle came to England with the Normans. Fights could last all day: the accused won by holding out until the stars appeared. Battle needed no priest’s blessing, so it outlived the ordeal by six centuries. It was last claimed in 1818 and abolished by Parliament in 1819.'
      },
      oath: {
        title: 'Oath-helpers',
        line: 'Swear you are innocent, word perfect. Then find neighbors to swear your oath is clean.',
        tag: 'Fading in the king’s courts by 1200',
        need: 11,
        neighbors: ['Alice', 'Hugh', 'Agnes', 'Roger', 'Edith', 'Ralph', 'Joan', 'Simon', 'Emma', 'Osbert', 'Maud', 'Gilbert', 'Cecily', 'Walter'],
        pSwear: { good: 0.95, mid: 0.82, bad: 0.4 },
        steps: [
          { title: 'Gather your oath-helpers',
            body: 'This court will take your oath with the twelfth hand: you, plus eleven neighbors who swear your oath is true. They saw nothing. They swear to your character, so your reputation decides who comes.',
            act: 'Knock on doors' },
          { title: 'Swear the oath',
            body: 'One slip and the oath bursts. Learn it, then say it back in order.',
            ready: 'I know it by heart', say: 'Tap the words in order.' },
          { title: 'Twelve hands, one oath',
            body: 'Your helpers raise their hands and swear together:',
            chorus: 'By the Lord, the oath is clean and unblemished that he has sworn.',
            act: 'Hear the court' }
        ],
        formula: ['By the Lord,', 'I am guiltless', 'both in deed', 'and in counsel', 'of the charge', 'that Walter brings against me.'],
        formulaNote: 'Adapted from Old English oath formulas.',
        few: { stamp: 'Failed', tone: 'bad', title: 'Too few hands.',
          body: 'Only {n} of your neighbors would swear, and you need eleven. You have failed your law, and that counts as guilt.' },
        slip: { stamp: 'Failed', tone: 'bad', title: 'The oath bursts.',
          body: 'Your tongue slips. A broken oath counts as guilt, however honest you are.' },
        cleared: { stamp: 'Cleared', tone: 'good', title: 'Your neighbors stand by you.',
          body: 'Twelve hands, one clean oath. You are cleared, and nobody had to say a word about the cow.' },
        record: 'Henry II’s assizes pushed oaths out of serious royal criminal cases and sent the accused to the ordeal instead. Oath-helpers lived on in church courts, town courts and suits over debts. In English debt cases this wager of law survived until Parliament abolished it in 1833.'
      },
      inquest: {
        title: 'Pay for an inquest',
        line: 'Buy a royal writ. A jury of neighbors will say whether Walter accused you out of hatred and spite.',
        tag: 'The future knocking',
        steps: [
          { title: 'Buy the writ',
            body: 'For a fee, the king will sell you a writ called de odio et atia, “of hatred and spite.” It was mostly used against murder accusations. We have borrowed one for your cow.',
            act: 'Pay the king', next: 'Summon the jury',
            art: 'A purse of coins, the king’s chest, and a sealed writ.' },
          { title: 'Twelve lawful neighbors',
            body: 'The sheriff summons twelve men from your neighborhood. Nobody wants strangers. These men are chosen because they know you, and Walter, and Bramble.',
            act: 'Ask what they know', next: 'Put the question',
            art: 'Twelve neighbors stand in two rows, ready to swear.' },
          { title: 'The question',
            body: 'Did Walter accuse you out of hatred and spite?',
            act: 'Hear their answer' }
        ],
        know: {
          all: ['Walter has wanted your meadow since Michaelmas.', 'The fence by the brook fell in the spring flood.', 'Bramble wanders. Everyone knows Bramble wanders.'],
          good: 'You pulled my cart out of the ditch at harvest.',
          mid: 'You owe the miller two shillings. That makes you slow to pay, not a thief.',
          bad: 'This is the third cow to turn up in that barn.'
        },
        yes: { stamp: 'Bailed', tone: 'good', title: '“Spite,” they say.',
          body: 'You go home on bail to wait for the king’s justices, and Walter’s accusation loses its teeth. Twelve people who knew the facts settled it with words.' },
        no: { stamp: 'Denied', tone: 'bad', title: '“No spite,” they say.',
          body: 'They know you too well. Walter’s appeal goes ahead, and you will have to answer it, perhaps with a staff in your hand.' },
        fight: 'Fight Walter',
        record: 'Magna Carta (1215), clause 36, ordered that this writ be given free and never refused. Here the jury does its early job: neighbors on oath, telling a royal court what they know.'
      }
    },
    ending: {
      kicker: 'Every road ends here',
      year: '1215',
      body: 'In November 1215 the Fourth Lateran Council in Rome forbade priests to bless ordeals of fire and water. Without a blessing, an ordeal was just a burn or a bath. England’s judges needed a new way to decide guilt, and they turned to the people who knew the accused: juries of neighbors.'
    },
    labels: {
      case: 'Rex v. Juror {juror}',
      back: 'All trials',
      judgment: 'Judgment',
      record: 'From the record',
      again: 'Play this one again',
      other: 'Try another trial',
      tried: 'Tried',
      count: 'Trials tried: {n} of 5',
      allDone: 'You have tried every road. In 1200 you would have had one.'
    }
  };

  /* ---------- small helpers ---------- */
  function fill(s, map) { return String(s).replace(/\{(\w+)\}/g, function (m, k) { return map[k] != null ? map[k] : m; }); }
  function shuffle(a, rnd) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }

  /* ---------- drawing (SVG strings; colors come from CSS classes using page tokens) ---------- */
  function fig(x, y, o) {
    o = o || {};
    var t = o.tunic || 'acc';
    var s = '<g class="wo-fig' + (o.cls ? ' ' + o.cls : '') + '" transform="translate(' + x + ' ' + y + ')' + (o.flip ? ' scale(-1 1)' : '') + '">';
    if (o.robe) {
      s += '<path class="wo-t-' + t + ' wo-ol" d="M-8 -37 Q0 -40 8 -37 L13 -1 Q0 1.5 -13 -1 Z"/>';
    } else {
      s += '<line class="wo-ln wo-leg wo-leg-a" x1="-4" y1="-15" x2="-6" y2="0"/><line class="wo-ln wo-leg wo-leg-b" x1="4" y1="-15" x2="6" y2="0"/>';
      s += '<path class="wo-t-' + t + ' wo-ol" d="M-8 -37 Q0 -40 8 -37 L12 -14 Q0 -11 -12 -14 Z"/>';
    }
    var arms = {
      down: 'M-7 -34 L-11 -18 M7 -34 L11 -18',
      fwd: 'M-7 -34 L5 -27 M7 -34 L15 -28',
      up: 'M-7 -34 L-11 -18 M7 -34 L12 -51',
      point: 'M-7 -34 L-11 -18 M7 -34 L23 -38',
      both: 'M-7 -34 L-13 -50 M7 -34 L13 -50'
    };
    s += '<path class="wo-ln" d="' + arms[o.arm || 'down'] + '"/>';
    s += '<circle class="wo-skin" cx="0" cy="-45" r="7"/>';
    if (o.tonsure) s += '<path class="wo-hair" d="M-7 -46 A7 7 0 0 1 -5 -50.5 L-3 -48.5 A4 4 0 0 0 3 -48.5 L5 -50.5 A7 7 0 0 1 7 -46 Z"/>';
    else if (o.hair) s += '<path class="wo-hair" d="M-7 -46 A7 7 0 0 1 7 -46 Q0 -49 -7 -46 Z"/>';
    s += (o.extra || '') + '</g>';
    return s;
  }

  function cow(x, y) {
    return '<g class="wo-cow" transform="translate(' + x + ' ' + y + ')">' +
      '<path class="wo-ln wo-cow-tail" d="M51 5 q10 4 7 19"/>' +
      '<rect class="wo-cow-leg" x="5" y="21" width="5" height="15" rx="1.5"/><rect class="wo-cow-leg" x="14" y="21" width="5" height="15" rx="1.5"/>' +
      '<rect class="wo-cow-leg" x="33" y="21" width="5" height="15" rx="1.5"/><rect class="wo-cow-leg" x="42" y="21" width="5" height="15" rx="1.5"/>' +
      '<rect class="wo-cow-body" x="0" y="0" width="52" height="27" rx="11"/>' +
      '<path class="wo-cow-patch" d="M20 1 h15 q1 10 -7 13 q-8 -2 -8 -13z"/>' +
      '<path class="wo-cow-patch" d="M39 15 q8 -3 12 3 v3 q-6 5 -12 0z"/>' +
      '<g class="wo-cow-head" transform="translate(-14 -7)">' +
        '<path class="wo-horn" d="M4 3 q-6 -3 -5 -9 M16 3 q6 -3 5 -9"/>' +
        '<ellipse class="wo-cow-body" cx="-1" cy="5" rx="4" ry="2.5"/><ellipse class="wo-cow-body" cx="21" cy="5" rx="4" ry="2.5"/>' +
        '<rect class="wo-cow-body" x="0" y="0" width="20" height="20" rx="8"/>' +
        '<rect class="wo-cow-muzzle" x="-1" y="12" width="15" height="9" rx="4"/>' +
        '<circle class="wo-dot" cx="6" cy="8" r="1.5"/>' +
        '<path class="wo-hay" d="M1 19 l-10 2 M2 20 l-8 6 M3 19 l-11 -2"/>' +
      '</g></g>';
  }

  function artHome() {
    var tufts = [14, 92, 150, 300].map(function (x) { return '<path class="wo-grass" d="M' + x + ' 114 l2 -6 l2 6 l2 -5 l1 5"/>'; }).join('');
    return '<svg viewBox="0 0 320 124" aria-hidden="true" focusable="false">' +
      '<path class="wo-hill" d="M0 84 Q70 68 150 80 T320 74"/>' +
      '<path class="wo-brook" d="M0 103 q14 -5 28 0 t28 0 t28 0"/>' +
      // fence, one rail fallen
      '<rect class="wo-post" x="14" y="86" width="4" height="28"/><rect class="wo-post" x="44" y="86" width="4" height="28"/><rect class="wo-post" x="74" y="92" width="4" height="22" transform="rotate(14 76 114)"/>' +
      '<line class="wo-rail" x1="16" y1="93" x2="46" y2="93"/><line class="wo-rail" x1="16" y1="102" x2="46" y2="102"/><line class="wo-rail" x1="48" y1="111" x2="80" y2="104"/>' +
      // barn
      '<rect class="wo-wall" x="172" y="56" width="132" height="58"/>' +
      '<path class="wo-roof" d="M163 59 L238 17 L313 59 Z"/>' +
      '<path class="wo-thatch" d="M185 50 L238 22 M200 52 L238 30 M290 50 L238 22 M276 52 L238 30"/>' +
      '<rect class="wo-door-dark" x="212" y="70" width="52" height="44"/>' +
      '<path class="wo-hay-pile" d="M232 114 q8 -16 18 -12 q8 -6 14 4 v8 z"/>' +
      cow(220, 78) +
      // Walter
      fig(126, 114, { tunic: 'brass', arm: 'point', hair: true }) +
      '<g class="wo-bubble"><rect x="84" y="18" width="66" height="22" rx="4"/><path d="M118 40 l4 8 l4 -8"/><text x="117" y="33" text-anchor="middle">My cow!</text></g>' +
      '<line class="wo-ground" x1="0" y1="114" x2="320" y2="114"/>' + tufts +
      '</svg>';
  }

  var ICONS = {
    iron: '<rect class="wo-hot" x="6" y="21" width="28" height="7" rx="2"/><path class="wo-heat" d="M12 16 q3 -3 0 -6 t0 -6 M20 16 q3 -3 0 -6 t0 -6 M28 16 q3 -3 0 -6 t0 -6"/>',
    water: '<line class="wo-rope" x1="20" y1="2" x2="20" y2="14"/><circle class="wo-skin" cx="20" cy="18" r="4"/><path class="wo-wave" d="M3 26 q4 -3 8.5 0 t8.5 0 t8.5 0 t8.5 0 M3 33 q4 -3 8.5 0 t8.5 0 t8.5 0 t8.5 0"/>',
    battle: '<line class="wo-staff" x1="6" y1="6" x2="34" y2="34"/><line class="wo-staff" x1="34" y1="6" x2="6" y2="34"/><path class="wo-shield" d="M11 10 h18 v12 q0 8 -9 12 q-9 -4 -9 -12 z"/><circle class="wo-boss" cx="20" cy="20" r="2.5"/>',
    oath: '<rect class="wo-skin" x="11" y="8" width="5" height="16" rx="2.5"/><rect class="wo-skin" x="16.5" y="5" width="5" height="19" rx="2.5"/><rect class="wo-skin" x="22" y="6" width="5" height="18" rx="2.5"/><rect class="wo-skin" x="27.5" y="10" width="4.5" height="14" rx="2.2"/><rect class="wo-skin" x="5" y="19" width="13" height="5" rx="2.5" transform="rotate(-40 11 21)"/><rect class="wo-skin" x="11" y="18" width="21" height="17" rx="7"/>',
    inquest: '<rect class="wo-parch" x="7" y="5" width="26" height="30" rx="2"/><path class="wo-lines" d="M11 12 h18 M11 17 h18 M11 22 h12"/><circle class="wo-wax" cx="27" cy="29" r="5"/>'
  };
  function icon(id) { return '<svg viewBox="0 0 40 40" aria-hidden="true" focusable="false">' + ICONS[id] + '</svg>'; }

  function artIron() {
    var ticks = [0, 3, 6, 9].map(function (ft, i) {
      var x = 70 + i * 66.67;
      return '<line class="wo-tick" x1="' + x + '" y1="146" x2="' + x + '" y2="154"/><text class="wo-tlabel" x="' + x + '" y="166" text-anchor="middle">' + ft + ' ft</text>';
    }).join('');
    var prints = [1, 2, 3].map(function (i) {
      var x = 70 + i * 66.67;
      return '<ellipse class="wo-print" data-print="' + i + '" cx="' + (x - 6) + '" cy="141" rx="5" ry="2"/>';
    }).join('');
    return '<svg viewBox="0 0 320 170" aria-hidden="true" focusable="false">' +
      '<path class="wo-win" d="M118 92 V48 Q131 22 144 48 V92 Z"/><path class="wo-win" d="M176 92 V48 Q189 22 202 48 V92 Z"/>' +
      '<line class="wo-ground" x1="0" y1="140" x2="320" y2="140"/>' +
      '<line class="wo-course" x1="70" y1="150" x2="270" y2="150"/>' + ticks + prints +
      // brazier
      '<path class="wo-flame wo-flame-a" d="M26 108 q-6 -12 4 -22 q0 8 6 10 q4 -8 2 -14 q12 10 6 26 z"/>' +
      '<path class="wo-flame wo-flame-b" d="M31 108 q-3 -8 3 -13 q1 5 4 6 q3 -4 2 -8 q6 7 2 15 z"/>' +
      '<path class="wo-brazier" d="M16 106 h40 l-6 12 h-28 z"/><path class="wo-ln" d="M24 118 l-5 22 M48 118 l5 22"/>' +
      '<line class="wo-mark" x1="263" y1="134" x2="277" y2="146"/><line class="wo-mark" x1="277" y1="134" x2="263" y2="146"/>' +
      fig(298, 140, { tunic: 'ink', robe: true, arm: 'up', tonsure: true }) +
      '<g class="wo-walker" transform="translate(70 140)"><g class="wo-walker-in">' +
        fig(0, 0, { tunic: 'acc', arm: 'fwd', hair: true, extra: '<rect class="wo-glow" x="5" y="-32" width="18" height="7" rx="3"/><rect class="wo-hot" x="7" y="-30.5" width="15" height="4" rx="1.5"/>' }) +
      '</g></g>' +
      '</svg>';
  }

  function artHand() {
    var days = [1, 2, 3].map(function (d, i) {
      var x = 206 + i * 36;
      return '<g class="wo-day" data-day="' + d + '"><rect x="' + x + '" y="56" width="30" height="40" rx="3"/>' +
        '<text class="wo-day-k" x="' + (x + 15) + '" y="69" text-anchor="middle">DAY</text><text class="wo-day-n" x="' + (x + 15) + '" y="89" text-anchor="middle">' + d + '</text></g>';
    }).join('');
    return '<svg viewBox="0 0 320 170" aria-hidden="true" focusable="false">' +
      '<line class="wo-ground" x1="0" y1="164" x2="320" y2="164"/>' +
      '<g class="wo-hand">' +
        '<rect class="wo-skin" x="82" y="40" width="13" height="50" rx="6.5"/><rect class="wo-skin" x="97" y="31" width="13" height="58" rx="6.5"/>' +
        '<rect class="wo-skin" x="112" y="33" width="13" height="56" rx="6.5"/><rect class="wo-skin" x="127" y="44" width="12" height="46" rx="6"/>' +
        '<rect class="wo-skin" x="58" y="93" width="36" height="13" rx="6.5" transform="rotate(-38 76 99)"/>' +
        '<rect class="wo-skin" x="94" y="128" width="38" height="40"/>' +
        '<rect class="wo-skin" x="79" y="78" width="63" height="60" rx="20"/>' +
        '<path class="wo-burn" d="M92 106 Q111 99 130 107"/>' +
      '</g>' +
      '<g class="wo-result wo-result-clean"><path class="wo-heal" d="M92 106 Q111 99 130 107"/><path class="wo-shine" d="M146 76 l6 -6 M150 88 l9 -2 M144 64 l2 -8"/></g>' +
      '<g class="wo-result wo-result-foul"><circle cx="98" cy="104" r="6"/><circle cx="112" cy="101" r="7.5"/><circle cx="125" cy="106" r="5.5"/><circle cx="106" cy="112" r="4"/><circle cx="120" cy="114" r="3.5"/></g>' +
      '<g class="wo-bandage"><rect x="72" y="74" width="78" height="66" rx="14"/>' +
        '<path d="M72 88 L150 80 M72 101 L150 93 M72 114 L150 106 M72 127 L150 119"/>' +
        '<g class="wo-seal"><circle cx="111" cy="107" r="13"/><circle class="wo-seal-ring" cx="111" cy="107" r="8.5"/><path class="wo-seal-x" d="M107 103 l8 8 M115 103 l-8 8"/></g>' +
      '</g>' +
      days +
      '<text class="wo-tlabel" x="260" y="114" text-anchor="middle" data-daylabel>Three days</text>' +
      '</svg>';
  }

  function artWater() {
    return '<svg viewBox="0 0 320 180" aria-hidden="true" focusable="false">' +
      '<path class="wo-bank" d="M0 96 L92 96 Q102 96 106 106 L118 180 L0 180 Z"/>' +
      '<rect class="wo-water" x="100" y="102" width="220" height="78"/>' +
      '<line class="wo-depth" x1="146" y1="146" x2="314" y2="146"/><text class="wo-tlabel" x="312" y="140" text-anchor="end">sink past here</text>' +
      '<rect class="wo-post" x="86" y="20" width="7" height="77"/><rect class="wo-post" x="86" y="18" width="112" height="7"/><line class="wo-rail" x1="93" y1="44" x2="118" y2="25"/>' +
      '<line class="wo-rope" data-rope x1="190" y1="25" x2="190" y2="34"/>' +
      '<g class="wo-bound" transform="translate(190 34)">' +
        '<ellipse class="wo-t-acc wo-ol" cx="0" cy="25" rx="11" ry="13"/><path class="wo-bind" d="M-10 21 h20 M-10 29 h20"/>' +
        '<circle class="wo-skin" cx="0" cy="6" r="7"/><path class="wo-hair" d="M-7 5 A7 7 0 0 1 7 5 Q0 2 -7 5 Z"/>' +
      '</g>' +
      '<g class="wo-bubbles"><circle cx="184" cy="150" r="2.5"/><circle cx="196" cy="140" r="2"/><circle cx="188" cy="128" r="3"/></g>' +
      '<rect class="wo-water-front" x="100" y="102" width="220" height="78"/>' +
      '<path class="wo-surface" d="M100 102 q10 -4 20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0"/>' +
      '<ellipse class="wo-ripple" cx="190" cy="103" rx="16" ry="3"/>' +
      fig(42, 96, { tunic: 'ink', robe: true, arm: 'up', tonsure: true }) +
      '</svg>';
  }

  function artBattle() {
    var crowd = '';
    var cx = [22, 34, 47, 58, 76, 88, 250, 262, 275, 290, 302];
    cx.forEach(function (x, i) { crowd += '<circle class="wo-crowd" cx="' + x + '" cy="' + (98 - (i % 2) * 3) + '" r="4.5"/>'; });
    var posts = '';
    for (var x = 10; x <= 310; x += 50) posts += '<line class="wo-fence" x1="' + x + '" y1="96" x2="' + x + '" y2="120"/>';
    var stars = [[30, 22], [64, 40], [96, 16], [140, 34], [178, 14], [210, 44], [292, 20], [120, 58], [270, 56]].map(function (p, i) {
      return '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="' + (i % 3 === 0 ? 1.8 : 1.2) + '"/>';
    }).join('');
    function fighter(x, tunic, flip) {
      return '<g transform="translate(' + x + ' 150)' + (flip ? ' scale(-1 1)' : '') + '"><g class="wo-fighter">' +
        '<line class="wo-staff" x1="-6" y1="-30" x2="-18" y2="-66"/>' +
        fig(0, 0, { tunic: tunic, arm: 'fwd', hair: true }) +
        '<rect class="wo-shield" x="9" y="-41" width="14" height="25" rx="2"/><circle class="wo-boss" cx="16" cy="-28.5" r="2.5"/>' +
        '</g></g>';
    }
    return '<svg viewBox="0 0 320 170" aria-hidden="true" focusable="false" class="is-t0">' +
      '<rect class="wo-sky" x="0" y="0" width="320" height="120"/>' +
      '<g class="wo-stars">' + stars + '</g>' +
      '<path class="wo-moon" d="M256 22 a12 12 0 1 0 12 16 a9 9 0 1 1 -12 -16 z"/>' +
      '<circle class="wo-sun" cx="0" cy="0" r="11"/>' +
      '<path class="wo-hill-fill" d="M0 104 Q80 88 160 100 T320 96 V120 H0 Z"/>' +
      crowd +
      '<rect class="wo-field" x="0" y="118" width="320" height="52"/>' + posts +
      '<line class="wo-fence" x1="0" y1="104" x2="320" y2="104"/>' +
      fighter(122, 'acc', false) + fighter(198, 'brass', true) +
      '<text class="wo-tlabel" x="122" y="165" text-anchor="middle">You</text><text class="wo-tlabel" x="198" y="165" text-anchor="middle">Walter</text>' +
      '</svg>';
  }

  function artWrit() {
    var coins = [0, 1, 2].map(function (i) { return '<circle class="wo-coin" data-coin="' + i + '" cx="68" cy="' + (78 - i * 3) + '" r="7"/>'; }).join('');
    return '<svg viewBox="0 0 320 160" aria-hidden="true" focusable="false">' +
      '<line class="wo-ground" x1="0" y1="140" x2="320" y2="140"/>' +
      '<path class="wo-purse" d="M50 92 q-14 18 -6 36 q14 12 40 0 q8 -18 -6 -36 z"/><path class="wo-ln" d="M50 92 q14 6 28 0"/>' +
      coins +
      '<rect class="wo-chest" x="128" y="98" width="70" height="42" rx="3"/><path class="wo-chest-lid" d="M128 98 q35 -18 70 0 z"/>' +
      '<rect class="wo-band" x="140" y="98" width="6" height="42"/><rect class="wo-band" x="180" y="98" width="6" height="42"/><rect class="wo-slot" x="152" y="94" width="22" height="3" rx="1.5"/>' +
      '<text class="wo-tlabel" x="163" y="156" text-anchor="middle">the king</text>' +
      '<g class="wo-writ"><rect class="wo-parch" x="226" y="26" width="76" height="100" rx="3"/>' +
        '<text class="wo-writ-t" x="264" y="46" text-anchor="middle">De odio</text><text class="wo-writ-t" x="264" y="58" text-anchor="middle">et atia</text>' +
        '<path class="wo-lines" d="M236 72 h56 M236 80 h56 M236 88 h56 M236 96 h40"/>' +
        '<path class="wo-ribbon" d="M276 112 l-6 22 M282 112 l6 22"/><circle class="wo-wax" cx="279" cy="112" r="9"/>' +
      '</g>' +
      '</svg>';
  }

  function artTwelve() {
    var tunics = ['acc', 'brass', 'ink', 'acc', 'seal', 'brass', 'ink', 'brass', 'acc', 'ink', 'seal', 'acc'];
    var s = '';
    for (var i = 0; i < 12; i++) {
      var back = i < 6;
      var x = back ? 42 + i * 47 : 66 + (i - 6) * 47;
      var y = back ? 94 : 148;
      s += '<g class="wo-juror" style="--d:' + (i * 45) + 'ms">' + fig(x, y, { tunic: tunics[i], hair: i % 3 !== 1, arm: 'down' }) + '</g>';
    }
    return '<svg viewBox="0 0 320 160" aria-hidden="true" focusable="false">' +
      '<line class="wo-ground" x1="0" y1="148" x2="320" y2="148"/>' + s +
      '<g class="wo-answer"><rect x="96" y="6" width="128" height="26" rx="4"/><text x="160" y="24" text-anchor="middle" data-answer></text></g>' +
      '</svg>';
  }

  /* =====================================================================================
     WIDGET
     ===================================================================================== */
  TS.register('ordeal', function (el, ctx) {
    var R = ctx.reduced;
    var rnd = ctx.rand || Math.random;
    var juror = ctx.juror || '0000';
    var state = {
      rep: ctx.store.get('rep', 'mid'),
      tried: ctx.store.get('tried', {}) || {},
      path: null
    };
    if (!DATA.reps[state.rep]) state.rep = 'mid';

    el.innerHTML = '<div class="w-ordeal"><div class="w-ordeal-stage"></div><p class="sr-only" aria-live="polite"></p></div>';
    var root = el.firstChild;
    var stage = root.querySelector('.w-ordeal-stage');
    var live = root.querySelector('[aria-live]');
    var acts = {};
    var timers = [];
    var rafs = [];

    function later(fn, ms) { var t = setTimeout(fn, R ? 0 : ms); timers.push(t); return t; }
    function clearAll() {
      timers.forEach(clearTimeout); timers = [];
      rafs.forEach(function (r) { cancelAnimationFrame(r.id); }); rafs = [];
    }
    function tween(ms, onFrame, onDone) {
      var rec = { id: 0 };
      if (R || ms <= 0) { onFrame(1); if (onDone) onDone(); return; }
      var t0 = null;
      function frame(t) {
        if (t0 === null) t0 = t;
        var k = Math.min(1, (t - t0) / ms);
        onFrame(k);
        if (k < 1) rec.id = requestAnimationFrame(frame);
        else if (onDone) onDone();
      }
      rec.id = requestAnimationFrame(frame);
      rafs.push(rec);
    }
    function ease(k) { return k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; }
    function say(msg) { live.textContent = ''; setTimeout(function () { live.textContent = msg; }, 40); }

    root.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]');
      if (!b || !root.contains(b) || b.disabled) return;
      var fn = acts[b.getAttribute('data-act')];
      if (fn) fn(b);
    });
    ctx.onVisible(function (v) { root.classList.toggle('is-paused', !v); });

    function revealTop() {
      var r = stage.getBoundingClientRect();
      if (r.top < 56 || r.top > window.innerHeight * 0.6) {
        stage.scrollIntoView({ block: 'start', behavior: R ? 'auto' : 'smooth' });
      }
    }
    function focusHead(scroll) {
      var hd = stage.querySelector('[data-focus]');
      if (hd) { hd.setAttribute('tabindex', '-1'); try { hd.focus({ preventScroll: true }); } catch (e) { hd.focus(); } }
      if (scroll) revealTop();
    }

    /* ---------- home: the charge sheet and the five trials ---------- */
    function pipsFor(rep) { return rep === 'good' ? 3 : rep === 'mid' ? 2 : 1; }
    function renderHome(scroll) {
      clearAll();
      state.path = null;
      acts = {};
      var s = DATA.sheet;
      var rows = s.rows.map(function (r) {
        return '<div><dt>' + r[0] + '</dt><dd>' + fill(r[1], { juror: juror }) + '</dd></div>';
      }).join('');
      var chips = ['good', 'mid', 'bad'].map(function (k) {
        return '<button type="button" class="chip" data-act="rep" data-arg="' + k + '" aria-pressed="' + (state.rep === k) + '">' + DATA.reps[k].label + '</button>';
      }).join('');
      var n = 0;
      var cards = DATA.order.map(function (id) {
        var p = DATA.paths[id];
        var done = state.tried[id];
        if (done) n++;
        return '<button type="button" class="w-ordeal-card' + (id === 'inquest' ? ' is-future' : '') + (done ? ' is-done' : '') + '" data-act="go" data-arg="' + id + '">' +
          '<span class="w-ordeal-card-icon">' + icon(id) + '</span>' +
          '<span class="w-ordeal-card-text"><span class="w-ordeal-card-title">' + p.title + '</span>' +
          '<span class="w-ordeal-card-line">' + p.line + '</span>' +
          '<span class="w-ordeal-card-tag">' + p.tag + '</span></span>' +
          (done ? '<span class="w-ordeal-card-done">' + DATA.labels.tried + ': ' + done + '</span>' : '') +
          '</button>';
      }).join('');
      stage.innerHTML =
        '<div class="w-ordeal-home">' +
          '<div class="w-ordeal-sheet">' +
            '<div class="w-ordeal-sheet-head"><span class="label">' + s.court + '</span><span class="w-ordeal-when">' + s.when + '</span></div>' +
            '<div class="w-ordeal-art w-ordeal-art-home" role="img" aria-label="' + s.art + '">' + artHome() + '</div>' +
            '<dl class="w-ordeal-fields">' + rows + '</dl>' +
            '<p class="w-ordeal-reign">' + s.reign + '</p>' +
          '</div>' +
          '<div class="w-ordeal-rep">' +
            '<p class="label" id="w-ordeal-repq">' + DATA.repQ + '</p>' +
            '<div class="chips" role="group" aria-labelledby="w-ordeal-repq">' + chips + '</div>' +
            '<p class="w-ordeal-rep-gloss"><span class="w-ordeal-pips" aria-hidden="true">' + pipsHtml(pipsFor(state.rep)) + '</span><span data-gloss>' + DATA.reps[state.rep].gloss + '</span></p>' +
          '</div>' +
          '<div class="w-ordeal-choose">' +
            '<h4 class="w-ordeal-h" data-focus>' + DATA.chooseTitle + '</h4>' +
            '<p class="w-ordeal-note">' + DATA.chooseNote + '</p>' +
            '<div class="w-ordeal-cards">' + cards + '</div>' +
            '<p class="w-ordeal-count">' + (n === 5 ? DATA.labels.allDone : fill(DATA.labels.count, { n: n })) + '</p>' +
          '</div>' +
        '</div>';
      acts.rep = function (b) {
        state.rep = b.getAttribute('data-arg');
        ctx.store.set('rep', state.rep);
        stage.querySelectorAll('[data-act="rep"]').forEach(function (c) { c.setAttribute('aria-pressed', String(c === b)); });
        stage.querySelector('[data-gloss]').textContent = DATA.reps[state.rep].gloss;
        stage.querySelector('.w-ordeal-pips').innerHTML = pipsHtml(pipsFor(state.rep));
        say(DATA.reps[state.rep].label + '. ' + DATA.reps[state.rep].gloss);
      };
      acts.go = function (b) { start(b.getAttribute('data-arg')); };
      if (scroll) focusHead(true);
    }
    function pipsHtml(n) {
      var s = '';
      for (var i = 0; i < 3; i++) s += '<i class="' + (i < n ? 'is-on' : '') + '"></i>';
      return s;
    }

    /* ---------- scene shell shared by every path ---------- */
    function shell(id, artHtml, artLabel) {
      clearAll();
      state.path = id;
      var p = DATA.paths[id];
      stage.innerHTML =
        '<div class="w-ordeal-scene" data-path="' + id + '">' +
          '<div class="w-ordeal-strip"><span class="w-ordeal-strip-case">' + fill(DATA.labels.case, { juror: juror }) + '</span>' +
          '<span class="w-ordeal-strip-path">' + p.title + '</span>' +
          '<button type="button" class="btn btn-ghost w-ordeal-leave" data-act="home">' + DATA.labels.back + '</button></div>' +
          '<div class="w-ordeal-art"></div>' +
          '<div class="w-ordeal-hud" hidden></div>' +
          '<div class="w-ordeal-step"></div>' +
        '</div>';
      setArt(artHtml, artLabel);
    }
    function art() { return stage.querySelector('.w-ordeal-art'); }
    function svg() { return stage.querySelector('.w-ordeal-art svg'); }
    function setArt(html, label) {
      var a = art();
      a.innerHTML = html;
      if (label) { a.setAttribute('role', 'img'); a.setAttribute('aria-label', label); }
      else { a.removeAttribute('role'); a.removeAttribute('aria-label'); }
    }
    function hud(html) {
      var h = stage.querySelector('.w-ordeal-hud');
      if (html == null) { h.hidden = true; h.innerHTML = ''; return; }
      h.hidden = false; h.innerHTML = html;
    }
    function step(o) {
      var box = stage.querySelector('.w-ordeal-step');
      acts = { home: function () { renderHome(true); } };
      var btns = (o.actions || []).map(function (a) {
        acts[a.act] = a.fn;
        return '<button type="button" class="' + (a.cls || 'btn') + '" data-act="' + a.act + '"' + (a.disabled ? ' disabled' : '') + '>' + a.label + '</button>';
      }).join('');
      box.innerHTML =
        (o.kicker ? '<p class="w-ordeal-kicker">' + o.kicker + '</p>' : '') +
        '<h4 class="w-ordeal-h" data-focus>' + o.title + '</h4>' +
        (o.body ? '<p class="w-ordeal-p">' + o.body + '</p>' : '') +
        (o.extra || '') +
        (btns ? '<div class="btn-row w-ordeal-actions">' + btns + '</div>' : '');
      if (!R) { box.classList.remove('is-in'); void box.offsetWidth; box.classList.add('is-in'); }
      focusHead(o.scroll !== false);
      if (o.say) say(o.say);
    }
    function setActions(list) {
      var row = stage.querySelector('.w-ordeal-actions');
      if (!row) {
        row = document.createElement('div');
        row.className = 'btn-row w-ordeal-actions';
        stage.querySelector('.w-ordeal-step').appendChild(row);
      }
      row.innerHTML = list.map(function (a) {
        acts[a.act] = a.fn;
        return '<button type="button" class="' + (a.cls || 'btn') + '" data-act="' + a.act + '"' + (a.disabled ? ' disabled' : '') + '>' + a.label + '</button>';
      }).join('');
      var first = row.querySelector('button:not([disabled])');
      if (first && root.contains(document.activeElement)) first.focus({ preventScroll: true });
    }
    function kicker(id, n, of) { return DATA.paths[id].title + ' · Step ' + n + ' of ' + of; }

    /* ---------- outcome: judgment, the record, and the 1215 ending ---------- */
    function outcome(id, o, extraActions) {
      clearAll();
      var p = DATA.paths[id];
      state.tried[id] = o.stamp.toLowerCase();
      ctx.store.set('tried', state.tried);
      var box = stage.querySelector('.w-ordeal-step');
      acts = {
        home: function () { renderHome(true); },
        again: function () { start(id); }
      };
      var extra = '';
      (extraActions || []).forEach(function (a) {
        acts[a.act] = a.fn;
        extra += '<button type="button" class="btn btn-seal" data-act="' + a.act + '">' + a.label + '</button>';
      });
      var E = DATA.ending;
      box.innerHTML =
        '<div class="w-ordeal-judgment is-' + o.tone + '">' +
          '<div class="w-ordeal-judgment-head"><span class="label">' + DATA.labels.judgment + '</span><span class="w-ordeal-judgment-case">' + fill(DATA.labels.case, { juror: juror }) + '</span></div>' +
          '<span class="w-ordeal-stamp" aria-hidden="true">' + o.stamp + '</span>' +
          '<h4 class="w-ordeal-h" data-focus><span class="sr-only">' + o.stamp + '. </span>' + o.title + '</h4>' +
          '<p class="w-ordeal-p">' + fill(o.body, o.vars || {}) + '</p>' +
        '</div>' +
        '<div class="w-ordeal-record"><p class="label">' + DATA.labels.record + '</p><p>' + p.record + '</p></div>' +
        '<div class="w-ordeal-end"><p class="label">' + E.kicker + '</p><p class="w-ordeal-end-year" aria-hidden="true">' + E.year + '</p><p>' + E.body + '</p></div>' +
        '<div class="btn-row w-ordeal-actions">' + extra +
          '<button type="button" class="btn" data-act="home">' + DATA.labels.other + '</button>' +
          '<button type="button" class="btn btn-ghost" data-act="again">' + DATA.labels.again + '</button>' +
        '</div>';
      if (!R) { box.classList.remove('is-in'); void box.offsetWidth; box.classList.add('is-in'); }
      focusHead(false);
      var j = box.querySelector('.w-ordeal-judgment');
      var r = j.getBoundingClientRect();
      if (r.top < 56 || r.bottom > window.innerHeight) j.scrollIntoView({ block: 'start', behavior: R ? 'auto' : 'smooth' });
      say(o.stamp + '. ' + o.title + ' ' + fill(o.body, o.vars || {}));
      later(function () { ctx.stamp('ordeal'); }, 700);
    }

    function start(id) {
      ({ iron: runIron, water: runWater, battle: runBattle, oath: runOath, inquest: runInquest })[id]();
    }

    /* ---------- path: hot iron ---------- */
    function runIron() {
      var P = DATA.paths.iron;
      shell('iron', artIron(), P.steps[0].art);
      hud('<span class="label">Carried</span><b class="tnum" data-ft>0</b><span>of 9 feet</span>');
      step({ kicker: kicker('iron', 1, 3), title: P.steps[0].title, body: P.steps[0].body,
        extra: '<p class="w-ordeal-hint">' + P.steps[0].holdHint + '</p>',
        actions: [{ label: P.steps[0].hold, act: 'carry', cls: 'btn w-ordeal-hold', fn: function () {} }] });
      var walker = svg().querySelector('.wo-walker');
      var ftEl = stage.querySelector('[data-ft]');
      var btn = stage.querySelector('.w-ordeal-hold');
      var prog = 0, done = false;
      function paint(p) {
        walker.setAttribute('transform', 'translate(' + (70 + p * 200).toFixed(1) + ' 140)');
        ftEl.textContent = Math.floor(p * 9 + 0.001);
        svg().querySelectorAll('[data-print]').forEach(function (fp) {
          fp.classList.toggle('is-on', p >= (+fp.getAttribute('data-print')) / 3 - 0.001);
        });
        btn.style.setProperty('--p', p.toFixed(3));
      }
      function finish() {
        if (done) return;
        done = true;
        btn.disabled = true;
        btn.classList.remove('is-holding');
        svg().classList.remove('is-walking');
        say('You reach the mark. Nine feet.');
        later(ironBind, 450);
      }
      holdControl(btn, {
        duration: 1700,
        get: function () { return prog; },
        set: function (p) { prog = p; paint(p); if (p >= 1) finish(); },
        onHold: function (on) { svg().classList.toggle('is-walking', on && !done); },
        stepSize: 1 / 3
      });
    }
    function ironBind() {
      var P = DATA.paths.iron;
      setArt(artHand(), P.steps[1].art);
      hud(null);
      step({ kicker: kicker('iron', 2, 3), title: P.steps[1].title, body: P.steps[1].body,
        actions: [{ label: P.steps[1].act, act: 'bind', fn: function () {
          svg().classList.add('is-bound');
          say('Your hand is bound in cloth and sealed with wax.');
          setActions([{ label: P.steps[1].wait, act: 'wait', fn: ironWait }]);
        } }] });
    }
    function ironWait() {
      var P = DATA.paths.iron;
      setActions([{ label: P.steps[1].wait, act: 'wait', disabled: true, fn: function () {} }]);
      var tiles = svg().querySelectorAll('.wo-day');
      [0, 1, 2].forEach(function (i) {
        later(function () { tiles[i].classList.add('is-on'); }, 120 + i * 380);
      });
      later(function () {
        step({ kicker: kicker('iron', 3, 3), title: P.steps[2].title, body: P.steps[2].body, scroll: false,
          actions: [{ label: P.steps[2].act, act: 'unbind', cls: 'btn btn-seal', fn: function () {
            var clean = rnd() < P.pClean;
            var s = svg();
            s.classList.add('is-unbound', clean ? 'is-clean' : 'is-foul');
            setActions([]);
            later(function () { outcome('iron', clean ? P.clean : P.foul); }, 900);
          } }] });
      }, 120 + 3 * 380);
    }

    /* press-and-hold control with tap and keyboard fallbacks */
    function holdControl(btn, o) {
      var holding = false, downAt = 0, last = 0, rafId = 0, lastInput = 0;
      function tick(t) {
        if (!holding) return;
        if (!last) last = t;
        var p = Math.min(1, o.get() + (t - last) / o.duration);
        last = t;
        o.set(p);
        if (p >= 1) { stop(false); return; }
        rafId = requestAnimationFrame(tick);
      }
      function begin() {
        if (btn.disabled || holding) return;
        holding = true; downAt = Date.now(); last = 0;
        btn.classList.add('is-holding');
        if (o.onHold) o.onHold(true);
        if (!R) rafId = requestAnimationFrame(tick);
      }
      function stop(maybeTap) {
        if (!holding) return;
        holding = false;
        cancelAnimationFrame(rafId);
        btn.classList.remove('is-holding');
        if (o.onHold) o.onHold(false);
        if (maybeTap && (R || Date.now() - downAt < 260)) stepOnce();
      }
      function stepOnce() {
        if (btn.disabled) return;
        var p = o.get();
        var next = Math.min(1, (Math.floor(p / o.stepSize + 0.0001) + 1) * o.stepSize);
        if (R) { o.set(next); return; }
        var from = p;
        if (o.onHold) o.onHold(true);
        tween(260, function (k) { o.set(from + (next - from) * k); }, function () { if (o.onHold && o.get() < 1) o.onHold(false); });
      }
      btn.addEventListener('pointerdown', function (e) {
        if (e.button && e.button !== 0) return;
        lastInput = Date.now();
        e.preventDefault();
        try { btn.setPointerCapture(e.pointerId); } catch (err) {}
        btn.focus({ preventScroll: true });
        begin();
      });
      btn.addEventListener('pointerup', function () { lastInput = Date.now(); stop(true); });
      btn.addEventListener('pointercancel', function () { stop(false); });
      btn.addEventListener('lostpointercapture', function () { stop(false); });
      btn.addEventListener('contextmenu', function (e) { e.preventDefault(); });
      btn.addEventListener('keydown', function (e) {
        if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); lastInput = Date.now(); if (!e.repeat) begin(); }
      });
      btn.addEventListener('keyup', function (e) {
        if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); lastInput = Date.now(); stop(true); }
      });
      // assistive tech may send a bare click with no pointer or key events
      btn.addEventListener('click', function () { if (Date.now() - lastInput > 400) stepOnce(); });
    }

    /* ---------- path: cold water ---------- */
    function runWater() {
      var P = DATA.paths.water;
      var S = P.steps[0];
      shell('water', artWater(), S.art);
      step({ kicker: DATA.paths.water.title, title: S.title, body: S.body,
        extra: '<p class="w-ordeal-hint">' + P.physics + '</p>',
        actions: [
          { label: S.full, act: 'full', cls: 'btn btn-ghost', fn: function () { lower('full'); } },
          { label: S.empty, act: 'empty', cls: 'btn btn-ghost', fn: function () { lower('empty'); } }
        ] });
    }
    function lower(breath) {
      var P = DATA.paths.water;
      var sinks = rnd() < P.pSink[breath];
      setActions([]);
      say(breath === 'full' ? 'You fill your lungs. They lower you in.' : 'You breathe out. They lower you in.');
      var s = svg();
      var body = s.querySelector('.wo-bound');
      var rope = s.querySelector('[data-rope]');
      function at(y) {
        body.setAttribute('transform', 'translate(190 ' + y.toFixed(1) + ')');
        rope.setAttribute('y2', (y + 0.5).toFixed(1));
      }
      var y0 = 34, ySurf = 84, ySink = 128;
      tween(560, function (k) { at(y0 + (ySurf - y0) * ease(k)); }, function () {
        s.classList.add('is-splash');
        if (sinks) {
          s.classList.add('is-sinking');
          tween(620, function (k) { at(ySurf + (ySink - ySurf) * ease(k)); }, function () {
            say('You sink past the mark.');
            later(function () {
              s.classList.remove('is-sinking');
              tween(520, function (k) { at(ySink + (52 - ySink) * ease(k)); }, function () {
                later(function () { outcome('water', state.rep === 'bad' ? P.sinkBad : P.sink); }, 250);
              });
            }, 420);
          });
        } else {
          tween(900, function (k) {
            var dip = Math.sin(k * Math.PI * 2.5) * (1 - k) * 12;
            at(ySurf + Math.max(-4, dip));
          }, function () {
            say('You float.');
            later(function () { outcome('water', P.float); }, 500);
          });
        }
      });
    }

    /* ---------- path: battle ---------- */
    function runBattle() {
      var P = DATA.paths.battle;
      var S = P.steps[0];
      shell('battle', artBattle(), S.art);
      var st = { you: 6, him: 6, round: 0, last: '' };
      hud(battleHud(st));
      step({ kicker: P.title, title: S.title, body: S.body,
        actions: [{ label: S.act, act: 'enter', fn: function () { battleRound(st); } }] });
    }
    function battleHud(st) {
      function pips(n, max) { var s = ''; for (var i = 0; i < max; i++) s += '<i class="' + (i < n ? 'is-on' : '') + '"></i>'; return s; }
      return '<span class="w-ordeal-hp"><span class="label">You</span><span class="w-ordeal-hp-pips" aria-label="' + Math.max(0, st.you) + ' of 6 strength">' + pips(st.you, 6) + '</span></span>' +
        '<span class="w-ordeal-hp"><span class="label">Walter</span><span class="w-ordeal-hp-pips is-him" aria-label="' + Math.max(0, st.him) + ' of 6 strength">' + pips(st.him, 6) + '</span></span>';
    }
    function setTime(i) {
      var s = svg();
      s.setAttribute('class', 'is-t' + i);
    }
    function battleRound(st) {
      var P = DATA.paths.battle;
      setTime(st.round);
      step({ kicker: 'Round ' + (st.round + 1) + ' of 4 · ' + P.times[st.round], title: P.roundTitle,
        body: st.last ? st.last : P.tips, scroll: st.round === 0,
        actions: [
          { label: P.strike, act: 'strike', cls: 'btn btn-seal', fn: function () { battleMove(st, 'strike'); } },
          { label: P.guard, act: 'guard', cls: 'btn btn-ghost', fn: function () { battleMove(st, 'guard'); } }
        ] });
    }
    function battleMove(st, move) {
      var P = DATA.paths.battle;
      var s = svg();
      var fighters = s.querySelectorAll('.wo-fighter');
      var you = fighters[0], him = fighters[1];
      var r = rnd(), msg;
      setActions([]);
      function anim(node, cls) { node.classList.remove('is-lunge', 'is-hit', 'is-block'); void node.getBoundingClientRect(); node.classList.add(cls); }
      if (move === 'strike') {
        anim(you, 'is-lunge');
        if (r < 0.55) { st.him -= 2; msg = P.msgs.hitHim; later(function () { anim(him, 'is-hit'); }, 160); }
        else { st.you -= 2; msg = P.msgs.hitYou; later(function () { anim(him, 'is-lunge'); anim(you, 'is-hit'); }, 260); }
      } else {
        anim(him, 'is-lunge');
        if (r < 0.75) { st.you -= 1; msg = P.msgs.block; later(function () { anim(you, 'is-block'); }, 160); }
        else { st.you -= 2; msg = P.msgs.hitYou; later(function () { anim(you, 'is-hit'); }, 160); }
      }
      say(msg);
      later(function () {
        hud(battleHud(st));
        if (st.him <= 0) { s.classList.add('is-yield'); later(function () { outcome('battle', P.craven); }, 500); return; }
        if (st.you <= 0) { s.classList.add('is-down'); later(function () { outcome('battle', P.lost); }, 500); return; }
        st.round++;
        st.last = msg;
        if (st.round >= 4) {
          setTime(4);
          say('The stars come out.');
          later(function () { outcome('battle', P.stars); }, 900);
          return;
        }
        battleRound(st);
      }, 620);
    }

    /* ---------- path: oath-helpers ---------- */
    function runOath() {
      var P = DATA.paths.oath;
      var houses = P.neighbors.map(function (name, i) {
        return '<div class="w-ordeal-nb" data-i="' + i + '"><svg viewBox="0 0 40 38" aria-hidden="true" focusable="false">' +
          '<path class="wo-roof" d="M2 17 L20 3 L38 17 Z"/><rect class="wo-wall" x="6" y="16" width="28" height="21"/>' +
          '<g class="wo-nb-fig"><circle class="wo-skin" cx="20" cy="24" r="3.2"/><path class="wo-t-acc" d="M16.5 37 L17.5 28 Q20 27 22.5 28 L23.5 37 Z"/><line class="wo-ln" x1="22.5" y1="29" x2="26" y2="21"/></g>' +
          '<rect class="wo-door" x="15.5" y="21" width="9" height="16"/><line class="wo-bar" x1="13" y1="27" x2="27" y2="27"/>' +
          '</svg><span class="w-ordeal-nb-name">' + name + '</span><span class="w-ordeal-nb-say" aria-hidden="true"></span></div>';
      }).join('');
      shell('oath', '<div class="w-ordeal-village">' + houses + '</div>', null);
      hud('<span class="label">Oath-helpers</span><b class="tnum" data-n>0</b><span>of ' + P.need + ' needed</span>');
      step({ kicker: kicker('oath', 1, 3), title: P.steps[0].title, body: P.steps[0].body,
        actions: [{ label: P.steps[0].act, act: 'knock', fn: function () { knock(); } }] });
    }
    function knock() {
      var P = DATA.paths.oath;
      setActions([]);
      var p = P.pSwear[state.rep];
      var cards = stage.querySelectorAll('.w-ordeal-nb');
      var nEl = stage.querySelector('[data-n]');
      var count = 0;
      var results = P.neighbors.map(function (name) { return name === 'Walter' ? false : rnd() < p; });
      results.forEach(function (ok, i) {
        later(function () {
          var c = cards[i];
          c.classList.add(ok ? 'is-yes' : 'is-no');
          c.querySelector('.w-ordeal-nb-say').textContent = ok ? 'swears' : (P.neighbors[i] === 'Walter' ? 'ha!' : 'no');
          if (ok) { count++; nEl.textContent = count; }
        }, 90 + i * 110);
      });
      later(function () {
        var total = results.filter(Boolean).length;
        if (total >= P.need) {
          say(total + ' neighbors will swear for you. Enough.');
          setActions([{ label: 'Swear your oath', act: 'swear', fn: oathLearn }]);
        } else {
          say('Only ' + total + ' will swear.');
          later(function () { outcome('oath', { stamp: P.few.stamp, tone: P.few.tone, title: P.few.title, body: P.few.body, vars: { n: total } }); }, 500);
        }
      }, 90 + results.length * 110 + 250);
    }
    function oathLearn() {
      var P = DATA.paths.oath;
      var S = P.steps[1];
      step({ kicker: kicker('oath', 2, 3), title: S.title, body: S.body,
        extra: '<blockquote class="w-ordeal-formula"><p>' + P.formula.join(' ') + '</p><footer>' + P.formulaNote + '</footer></blockquote>',
        actions: [{ label: S.ready, act: 'ready', fn: oathRecite }] });
    }
    function oathRecite() {
      var P = DATA.paths.oath;
      var S = P.steps[1];
      var order = P.formula.map(function (_, i) { return i; });
      var mixed = shuffle(order, rnd);
      if (mixed.join() === order.join()) mixed = mixed.slice(1).concat(mixed[0]);
      var chips = mixed.map(function (i) {
        return '<button type="button" class="w-ordeal-word" data-act="word" data-arg="' + i + '">' + P.formula[i] + '</button>';
      }).join('');
      step({ kicker: kicker('oath', 2, 3), title: S.title, body: S.say,
        extra: '<p class="w-ordeal-said" aria-live="polite"><span class="w-ordeal-said-empty">Your oath will appear here.</span></p><div class="w-ordeal-words">' + chips + '</div>' });
      var next = 0;
      var said = stage.querySelector('.w-ordeal-said');
      acts.word = function (b) {
        var i = +b.getAttribute('data-arg');
        if (i === next) {
          if (next === 0) said.innerHTML = '';
          var span = document.createElement('span');
          span.textContent = P.formula[i] + ' ';
          said.appendChild(span);
          b.disabled = true;
          b.classList.add('is-used');
          next++;
          if (next === P.formula.length) {
            stage.querySelectorAll('.w-ordeal-word').forEach(function (w) { w.disabled = true; });
            later(oathChorus, 450);
          } else {
            var nb = stage.querySelector('.w-ordeal-word:not([disabled])');
            if (nb && document.activeElement === b) nb.focus({ preventScroll: true });
          }
        } else {
          b.classList.add('is-wrong');
          stage.querySelectorAll('.w-ordeal-word').forEach(function (w) { w.disabled = true; });
          said.classList.add('is-burst');
          later(function () { outcome('oath', P.slip); }, 700);
        }
      };
    }
    function oathChorus() {
      var P = DATA.paths.oath;
      var S = P.steps[2];
      art().classList.add('is-sworn');
      step({ kicker: kicker('oath', 3, 3), title: S.title, body: S.body,
        extra: '<blockquote class="w-ordeal-formula is-chorus"><p>' + S.chorus + '</p><footer>' + P.formulaNote + '</footer></blockquote>',
        actions: [{ label: S.act, act: 'court', fn: function () { outcome('oath', P.cleared); } }] });
    }

    /* ---------- path: inquest of hatred and spite ---------- */
    function runInquest() {
      var P = DATA.paths.inquest;
      var S = P.steps[0];
      shell('inquest', artWrit(), S.art);
      step({ kicker: kicker('inquest', 1, 3), title: S.title, body: S.body,
        actions: [{ label: S.act, act: 'pay', fn: function () {
          var s = svg();
          s.classList.add('is-paid');
          setActions([]);
          say('You pay. The writ is sealed.');
          later(function () { setActions([{ label: S.next, act: 'summon', fn: inquestJury }]); }, 900);
        } }] });
    }
    function inquestJury() {
      var P = DATA.paths.inquest;
      var S = P.steps[1];
      setArt(artTwelve(), S.art);
      later(function () { svg().classList.add('is-in'); }, 30);
      step({ kicker: kicker('inquest', 2, 3), title: S.title, body: S.body,
        actions: [{ label: S.act, act: 'ask', fn: function () {
          var lines = P.know.all.slice(0, 2).concat([P.know[state.rep], P.know.all[2]]);
          var html = '<ul class="w-ordeal-slips">' + lines.map(function (t, i) { return '<li style="--d:' + (i * 160) + 'ms">' + t + '</li>'; }).join('') + '</ul>';
          var box = stage.querySelector('.w-ordeal-step');
          var row = box.querySelector('.w-ordeal-actions');
          row.insertAdjacentHTML('beforebegin', html);
          say(lines.join(' '));
          setActions([{ label: S.next, act: 'question', fn: inquestQuestion }]);
        } }] });
    }
    function inquestQuestion() {
      var P = DATA.paths.inquest;
      var S = P.steps[2];
      step({ kicker: kicker('inquest', 3, 3), title: S.title, body: S.body, scroll: true,
        actions: [{ label: S.act, act: 'answer', cls: 'btn btn-seal', fn: function () {
          var spite = state.rep !== 'bad';
          var s = svg();
          s.querySelector('[data-answer]').textContent = spite ? 'Spite!' : 'No spite.';
          s.classList.add('is-answered', spite ? 'is-yes' : 'is-no');
          setActions([]);
          later(function () {
            if (spite) outcome('inquest', P.yes);
            else outcome('inquest', P.no, [{ label: P.fight, act: 'fight', fn: runBattle }]);
          }, 900);
        } }] });
    }

    renderHome(false);
  });
})();
