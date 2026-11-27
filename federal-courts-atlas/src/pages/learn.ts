// Learn (#/learn): "How federal courts work". Plain-English primer with two
// hand-built diagrams and a circuit map, inline glossary terms throughout, and the
// full glossary. No statistics: counts of districts come from the statutory registry.

import '../styles/pages.css';
import '../styles/learn.css';
import { h } from '../lib/dom.ts';
import type { PageContext } from '../app/router.ts';
import { rich } from '../components/glossary.ts';
import { GLOSSARY } from '../content/glossary.ts';
import { DISTRICTS } from '../data/districts.ts';
import { loadAtlasGeometry } from '../map/geo.ts';
import { pageHead } from './_page.ts';
import { circuitMapFigure, mountLifecycleDiagram, mountStructureDiagram } from './learn-diagrams.ts';

export const title = 'How federal courts work';

const NUM_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five'];

/** Structural facts derived from the registry (so the text can never drift from it). */
function registryFacts() {
  const perState = new Map<string, number>();
  const stateNames = new Map<string, string>();
  for (const d of DISTRICTS) {
    if (['DC', 'PR', 'VI', 'GU', 'MP'].includes(d.state)) continue;
    perState.set(d.state, (perState.get(d.state) ?? 0) + 1);
    stateNames.set(d.state, d.stateName);
  }
  const single = [...perState.values()].filter((n) => n === 1).length;
  const max = Math.max(...perState.values());
  const maxStates = [...perState.entries()].filter(([, n]) => n === max).map(([st]) => stateNames.get(st)!);
  return { single, max, maxStates, states: perState.size };
}

function listJoin(xs: string[]): string {
  return xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;
}

function section(id: string, heading: string, ...children: Array<Node | string | null>): HTMLElement {
  return h('section', { class: 'learn-section', id, 'aria-labelledby': `${id}-h` }, h('h2', { id: `${id}-h`, class: 'learn-section__title' }, heading), ...children);
}

function p(text: string): HTMLParagraphElement {
  return h('p', null, rich(text));
}

export async function render(ctx: PageContext): Promise<() => void> {
  const facts = registryFacts();
  const page = h('div', { class: 'page learn-page' });
  const cleanups: Array<() => void> = [];

  const tocItems: Array<[string, string]> = [
    ['structure', 'Three levels of courts'],
    ['districts', 'Districts and divisions'],
    ['criminal', 'The life of a criminal case'],
    ['sentencing', 'How a sentence is set'],
    ['civil', 'Civil cases'],
    ['workload', 'Measuring a court’s work'],
    ['glossary', 'Glossary'],
  ];
  const toc = h(
    'nav',
    { class: 'learn-toc', 'aria-label': 'On this page' },
    h('p', { class: 'caps' }, 'On this page'),
    h(
      'ol',
      null,
      ...tocItems.map(([id, label]) => {
        const b = h('button', { type: 'button', class: 'learn-toc__link' }, label);
        b.addEventListener('click', () => {
          const el = document.getElementById(id);
          el?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
          const heading = el?.querySelector('h2');
          heading?.setAttribute('tabindex', '-1');
          heading?.focus({ preventScroll: true });
        });
        return h('li', null, b);
      }),
    ),
  );

  // (a) Structure
  const structureFig = h('figure', { class: 'learn-figure' });
  const structureCanvas = h('div', { class: 'diagram-host' });
  structureFig.append(
    structureCanvas,
    h('figcaption', { class: 'caption' }, 'Each square is one district court. Appeals go up one level to the court of appeals for the district’s circuit; the Supreme Court decides which cases to review. Hover a square to see the district’s name.'),
  );
  const circuitSlot = h('div', { class: 'learn-circuit-slot' });

  // (b) Life cycle
  const lifeFig = h('figure', { class: 'learn-figure' });
  const lifeCanvas = h('div', { class: 'diagram-host' });
  lifeFig.append(lifeCanvas, h('figcaption', { class: 'caption' }, 'The main stages of a federal criminal case. A case can also end earlier, for example by dismissal.'));

  const glossaryList = h('dl', { class: 'glossary-list' });
  const sorted = [...GLOSSARY].sort((a, b) => a.term.replace(/^§/, '').localeCompare(b.term.replace(/^§/, ''), 'en', { sensitivity: 'base' }));
  for (const g of sorted) {
    glossaryList.append(
      h('dt', { id: `g-${g.id}` }, rich(g.term.includes('*') ? g.term : g.term.replace(/^(Booker|TC Heartland)$/, '*$1*'))),
      h('dd', null, h('p', null, rich(g.definition)), g.cite ? h('p', { class: 'glossary-list__cite' }, g.cite) : null),
    );
  }

  const main = h(
    'div',
    { class: 'learn-main prose' },
    section(
      'structure',
      'Three levels of courts',
      p(
        'The federal judiciary has three levels. Cases begin in the 94 [[district|district courts]], the trial courts, where judges and juries hear evidence and decide cases. A party that loses in a district court can usually appeal to the [[court-of-appeals|court of appeals]] for its [[circuit]].',
      ),
      p(
        'The country is divided into 12 regional circuits: the First through the Eleventh, and the District of Columbia Circuit. A thirteenth court of appeals, the [[federal-circuit|Federal Circuit]], hears appeals in particular subjects, such as patents, from every district. At the top, the Supreme Court reviews decisions of the courts of appeals, and of state courts on questions of federal law, choosing its cases through petitions for [[certiorari]].',
      ),
      structureFig,
      p(
        'District judges in the states, the District of Columbia and Puerto Rico are [[article-iii|Article III]] judges, nominated by the President and confirmed by the Senate to serve during good behavior. The district courts of Guam, the Northern Mariana Islands and the Virgin Islands are [[article-iv|territorial courts]] whose judges serve ten-year terms. Every district court also has [[magistrate-judge|magistrate judges]], appointed by its judges, who handle many early and pretrial matters.',
      ),
      circuitSlot,
    ),
    section(
      'districts',
      'Districts and divisions',
      p(
        `Congress draws district lines by statute, mostly as lists of counties. ${facts.single === 1 ? 'One state forms' : `${facts.single} of the ${facts.states} states form`} a single district; the others are split into two, three or ${NUM_WORDS[facts.max] ?? facts.max}. ${listJoin(facts.maxStates)} each have ${NUM_WORDS[facts.max] ?? facts.max}. The District of Columbia and Puerto Rico are one district each, as are the three territorial courts.`,
      ),
      p(
        'Many districts are further split by statute into [[division|divisions]], each tied to one or more cities where court is held. Each district has its own clerk’s office, and each has a U.S. Attorney’s office that prosecutes federal crimes and represents the United States in civil cases, except that Guam and the Northern Mariana Islands share one [[us-attorney|U.S. Attorney]].',
      ),
    ),
    section(
      'criminal',
      'The life of a federal criminal case',
      lifeFig,
      h(
        'ol',
        { class: 'learn-steps' },
        h('li', null, rich('**Investigation.** Federal agents, such as those of the FBI, the DEA or Homeland Security Investigations, investigate suspected crimes, often with prosecutors from the district’s U.S. Attorney’s office. A [[grand-jury|grand jury]] can subpoena documents and witnesses.')),
        h('li', null, rich('**Charges.** A case may begin with a [[criminal-complaint|criminal complaint]] and an arrest, or with an [[indictment]] returned by a grand jury. A felony must be charged by indictment unless the defendant waives it and agrees to proceed by [[information]].')),
        h('li', null, rich('**Initial appearance.** Soon after arrest, the defendant appears before a [[magistrate-judge|magistrate judge]] at an [[initial-appearance|initial appearance]], hears the charges, and is told of the right to a lawyer, who is appointed if the defendant cannot afford one.')),
        h('li', null, rich('**Detention hearing.** When the government seeks it, a [[detention-hearing|detention hearing]] decides whether the defendant is released before trial, and on what conditions.')),
        h('li', null, rich('**Arraignment.** At the [[arraignment]] the defendant is formally told the charges and enters a plea.')),
        h('li', null, rich('**Discovery and plea talks.** The parties exchange evidence in [[discovery]], argue motions, and often negotiate a [[plea-agreement|plea agreement]].')),
        h('li', null, rich('**Plea or trial.** Most federal criminal cases end in a guilty plea. A defendant who goes to trial is entitled to a [[jury-trial|jury trial]], in which 12 jurors must agree unanimously, and may instead have a [[bench-trial|bench trial]] if the government and the court agree. An acquittal ends the case.')),
        h('li', null, rich('**Presentence report.** After a conviction, a probation officer prepares a [[presentence-report|presentence investigation report]], including a calculation of the [[guideline-range|guideline range]].')),
        h('li', null, rich('**Sentencing.** The judge resolves disputes over the report, calculates the guideline range, considers any [[departure|departures]], and weighs the [[sentencing-factors|§ 3553(a) factors]], which can support a [[variance]]. A sentence can include prison, probation, fines, restitution and [[supervised-release|supervised release]], within the limits set by statute.')),
        h('li', null, rich('**Appeal.** The defendant can appeal the conviction or the sentence to the [[court-of-appeals|court of appeals]]; the government can appeal some rulings and sentences, but not an acquittal. Many plea agreements include a waiver of some appeal rights.')),
      ),
    ),
    section(
      'sentencing',
      'How a federal sentence is set',
      p(
        'Federal sentences are shaped by the U.S. Sentencing Guidelines, written by the [[ussc|U.S. Sentencing Commission]]. The Guidelines took effect in 1987 and were binding on judges until 2005, when the Supreme Court’s decision in [[booker|*United States v. Booker*]] made them advisory. Judges must still calculate the [[guideline-range|guideline range]] correctly and consider it, but they may sentence outside it for reasons they explain on the record, within any [[mandatory-minimum|mandatory minimum]] and statutory maximum.',
      ),
      p(
        'Sentencing Commission data sort each sentence by where it falls relative to the range: within it, above it, or below it. Below-range sentences are further divided by whether the government asked for them, for example under [[5k1-1|§5K1.1]] for substantial assistance or [[5k3-1|§5K3.1]] for an early disposition program, or whether the judge imposed them without such a request. These categories describe outcomes; they do not by themselves explain why a sentence was chosen.',
      ),
      p('Congress has also changed sentencing law directly, most recently in the [[first-step-act|First Step Act]] of 2018.'),
    ),
    section(
      'civil',
      'Civil cases',
      p(
        'Federal courts hear civil cases that arise under federal law, cases in which the United States is a party, and certain disputes between citizens of different states when more than $75,000 is at stake. Each civil case is classified by its [[nature-of-suit|nature of suit]]. Some litigants represent themselves, or appear [[pro-se|pro se]]; many such cases are [[prisoner-petition|prisoner petitions]].',
      ),
      p(
        'A case is a [[pending-case|pending case]] from filing until its [[termination]]. Court statistics track how long that takes with the [[median-time|median time to disposition]], and how often cases end in a [[jury-trial|jury trial]] or a [[bench-trial|bench trial]] rather than by settlement, dismissal or another ruling.',
      ),
    ),
    section(
      'workload',
      'Measuring a court’s work',
      p(
        'Congress authorizes a fixed number of [[judgeship|judgeships]] for each district. When a judge takes [[senior-status|senior status]], retires or dies, the seat stays vacant until a successor is confirmed; [[vacant-judgeship-months|vacant judgeship months]] add up those gaps. Because cases differ in how much judicial time they demand, [[weighted-filings|weighted filings]] per judgeship are the standard measure of a court’s workload.',
      ),
      p(
        'The atlas draws court-level caseload figures from the Administrative Office’s [[fcms|Federal Court Management Statistics]], case-level detail from the Federal Judicial Center’s [[idb|Integrated Database]], and sentencing figures from the [[ussc|U.S. Sentencing Commission]]. Every number is shown with its source.',
      ),
    ),
    section('glossary', 'Glossary', h('p', { class: 'learn-glossary-intro' }, 'Terms used throughout the atlas. Underlined terms anywhere on the site open these definitions.'), glossaryList),
  );

  page.append(
    pageHead({
      kicker: 'Learn',
      title: 'How federal courts work',
      dek: 'A short guide to the federal trial courts: how they are organized, how a criminal case moves through them, and how their work is measured.',
    }),
    h('div', { class: 'learn-layout' }, toc, main),
  );
  ctx.root.append(page);

  cleanups.push(mountStructureDiagram(structureCanvas), mountLifecycleDiagram(lifeCanvas));
  void loadAtlasGeometry().then((r) => {
    if (r.status === 'ok') circuitSlot.replaceWith(circuitMapFigure(r.geometry));
    else circuitSlot.remove();
  });
  return () => cleanups.forEach((c) => c());
}
