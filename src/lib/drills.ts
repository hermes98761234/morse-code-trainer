/** Practice material (Koch order, words, callsigns, QSOs) and scoring of copied text. */

/** Koch character order used by LCWO / G4FON-style trainers. */
export const KOCH_ORDER = [...'KMURESNAPTLWI.JZ=FOY,VG5/Q92H38B?47C1D60X']

/** Characters taught at a Koch level (2 at level 1, one more per level). */
export function kochChars(level: number): string[] {
  const n = Math.max(2, Math.min(KOCH_ORDER.length, Math.floor(level) + 1))
  return KOCH_ORDER.slice(0, n)
}

export const MAX_KOCH_LEVEL = KOCH_ORDER.length - 1

export type Rng = () => number

/** Small deterministic generator (mulberry32). */
export function makeRng(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const pickOne = <T,>(rng: Rng, xs: readonly T[]): T => xs[Math.floor(rng() * xs.length)]

/** Random groups of characters, e.g. "KMR EU SNA". */
export function randomGroups(chars: readonly string[], groups: number, size: number, rng: Rng): string {
  const out: string[] = []
  for (let g = 0; g < groups; g++) {
    let s = ''
    for (let i = 0; i < size; i++) s += pickOne(rng, chars)
    out.push(s)
  }
  return out.join(' ')
}

export const WORDS = (
  'THE OF AND TO IN IS IT YOU THAT HE WAS FOR ON ARE WITH AS HIS THEY BE AT ONE HAVE THIS FROM OR HAD BY HOT WORD BUT WHAT SOME WE CAN OUT OTHER WERE ALL THERE WHEN UP USE YOUR HOW SAID AN EACH SHE WHICH DO THEIR TIME IF WILL WAY ABOUT MANY THEN THEM WRITE WOULD LIKE SO THESE HER LONG MAKE THING SEE HIM TWO HAS LOOK MORE DAY COULD GO COME DID NUMBER SOUND NO MOST PEOPLE MY OVER KNOW WATER THAN CALL FIRST WHO MAY DOWN SIDE BEEN NOW FIND ANY NEW WORK PART TAKE GET PLACE MADE LIVE WHERE AFTER BACK LITTLE ONLY ROUND MAN YEAR CAME SHOW EVERY GOOD ME GIVE OUR UNDER NAME VERY THROUGH JUST FORM MUCH GREAT THINK SAY HELP LOW LINE BEFORE TURN CAUSE SAME MEAN DIFFERENT MOVE RIGHT BOY OLD TOO DOES TELL SENTENCE SET THREE WANT AIR WELL ALSO PLAY SMALL END PUT HOME READ HAND PORT LARGE SPELL ADD EVEN LAND HERE MUST BIG HIGH SUCH FOLLOW ACT WHY ASK MEN CHANGE WENT LIGHT KIND OFF NEED HOUSE PICTURE TRY US AGAIN ANIMAL POINT MOTHER WORLD NEAR BUILD SELF EARTH FATHER HEAD STAND OWN PAGE SHOULD COUNTRY FOUND ANSWER SCHOOL GROW STUDY STILL LEARN PLANT COVER FOOD SUN FOUR BETWEEN STATE KEEP EYE NEVER LAST LET THOUGHT CITY TREE CROSS FARM HARD START MIGHT STORY SAW FAR SEA DRAW LEFT LATE RUN WHILE PRESS CLOSE NIGHT REAL LIFE FEW NORTH OPEN SEEM TOGETHER NEXT WHITE CHILDREN BEGIN GOT WALK EXAMPLE EASE PAPER GROUP ALWAYS MUSIC THOSE BOTH MARK OFTEN LETTER UNTIL MILE RIVER CAR FEET CARE SECOND BOOK CARRY TOOK SCIENCE EAT ROOM FRIEND BEGAN IDEA FISH MOUNTAIN STOP ONCE BASE HEAR HORSE CUT SURE WATCH COLOR FACE WOOD MAIN ENOUGH PLAIN GIRL USUAL YOUNG READY ABOVE EVER RED LIST THOUGH FEEL TALK BIRD SOON BODY DOG FAMILY DIRECT POSE LEAVE SONG MEASURE DOOR PRODUCT BLACK SHORT NUMERAL CLASS WIND QUESTION HAPPEN COMPLETE SHIP AREA HALF ROCK ORDER FIRE SOUTH PROBLEM PIECE TOLD KNEW PASS SINCE TOP WHOLE KING SPACE HEARD BEST HOUR BETTER TRUE DURING HUNDRED FIVE REMEMBER STEP EARLY HOLD WEST GROUND INTEREST REACH FAST VERB SING LISTEN SIX TABLE TRAVEL LESS MORNING TEN SIMPLE SEVERAL VOWEL TOWARD WAR LAY AGAINST PATTERN SLOW CENTER LOVE PERSON MONEY SERVE APPEAR ROAD MAP RAIN RULE GOVERN PULL COLD NOTICE VOICE UNIT POWER TOWN FINE CERTAIN FLY FALL LEAD CRY DARK MACHINE NOTE WAIT PLAN FIGURE STAR BOX NOUN FIELD REST CORRECT ABLE POUND DONE BEAUTY DRIVE STOOD CONTAIN FRONT TEACH WEEK FINAL GAVE GREEN OH QUICK DEVELOP SLEEP WARM FREE MINUTE STRONG SPECIAL MIND BEHIND CLEAR TAIL PRODUCE FACT STREET INCH LOT NOTHING COURSE STAY WHEEL FULL FORCE BLUE OBJECT DECIDE SURFACE DEEP MOON ISLAND FOOT YET BUSY TEST RECORD BOAT COMMON GOLD POSSIBLE PLANE AGE DRY WONDER LAUGH THOUSAND AGO RAN CHECK GAME SHAPE YES HOT MISS BRING HEAT SNOW TIRE BRING RADIO ANTENNA SIGNAL BAND POWER CODE KEY TONE MORSE WIRE TOWER WEATHER CLOUD'
).split(' ')

/** Words whose letters are all among `chars`; falls back to random groups if the pool is too small. */
export function randomWords(chars: readonly string[], count: number, rng: Rng): string {
  const set = new Set(chars)
  const pool = [...new Set(WORDS)].filter((w) => [...w].every((c) => set.has(c)))
  if (pool.length < 3) return randomGroups(chars, count, 4, rng)
  const out: string[] = []
  for (let i = 0; i < count; i++) out.push(pickOne(rng, pool))
  return out.join(' ')
}

const PREFIXES = ['W', 'K', 'N', 'AA', 'KA', 'WB', 'VE', 'G', 'M', 'DL', 'DJ', 'F', 'I', 'EA', 'PA', 'ON', 'OZ', 'SM', 'LA', 'OH', 'SP', 'OK', 'HA', 'YO', 'LZ', 'UR', 'UT', 'US', 'UA', 'JA', 'VK', 'ZL', 'PY', 'LU', 'ZS', 'HB9']
const LETTERS = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ']

/** A plausible amateur callsign such as "DL4XYZ" or "UR5AB". */
export function randomCallsign(rng: Rng): string {
  const suffixLen = 1 + Math.floor(rng() * 3)
  let suffix = ''
  for (let i = 0; i < suffixLen; i++) suffix += pickOne(rng, LETTERS)
  return `${pickOne(rng, PREFIXES)}${Math.floor(rng() * 10)}${suffix}`
}

export function randomCallsigns(count: number, rng: Rng): string {
  return Array.from({ length: count }, () => randomCallsign(rng)).join(' ')
}

const NAMES = ['JOHN', 'ANNA', 'PETER', 'OLEG', 'MARK', 'ELENA', 'TOM', 'ANDRII', 'HANS', 'PAUL', 'MARIA', 'IVAN', 'BOB', 'SAM', 'LUCA', 'ERIK', 'YURI', 'NICK']
const CITIES = ['BOSTON', 'KYIV', 'LVIV', 'BERLIN', 'PARIS', 'ROME', 'OSLO', 'DENVER', 'TOKYO', 'LEEDS', 'LODZ', 'BRNO', 'MADRID', 'PERTH', 'DALLAS', 'RIGA']
const RIGS = ['FT891', 'IC7300', 'KX3', 'TS590', 'K3', 'FT817', 'QRP']
const ANTS = ['DIPOLE', 'VERTICAL', 'YAGI', 'EFHW', 'LOOP', 'GP']

/** A short, typical CW contact: CQ call, answer, exchange, sign-off. */
export function randomQso(rng: Rng): string {
  const a = randomCallsign(rng)
  const b = randomCallsign(rng)
  const rst = pickOne(rng, ['599', '579', '559', '449', '339'])
  const lines = [
    `CQ CQ CQ DE ${a} ${a} K`,
    `${a} DE ${b} ${b} KN`,
    `${b} DE ${a} GM TNX FER CALL UR RST ${rst} ${rst} NAME ${pickOne(rng, NAMES)} QTH ${pickOne(rng, CITIES)} HW? <KN>`,
    `${a} DE ${b} R TKS ${pickOne(rng, NAMES)} RST ${rst} NAME ${pickOne(rng, NAMES)} QTH ${pickOne(rng, CITIES)} RIG ${pickOne(rng, RIGS)} ANT ${pickOne(rng, ANTS)} 73 <SK>`,
  ]
  return lines.join(' ')
}

export type DrillKind = 'koch' | 'words' | 'callsigns' | 'qso' | 'custom'

export interface DrillOptions {
  kind: DrillKind
  level: number
  count: number
  groupSize: number
  custom: string
}

export function makeDrill(o: DrillOptions, rng: Rng): string {
  const chars = kochChars(o.level)
  switch (o.kind) {
    case 'koch':
      return randomGroups(chars, o.count, o.groupSize, rng)
    case 'words':
      return randomWords(chars, o.count, rng)
    case 'callsigns':
      return randomCallsigns(o.count, rng)
    case 'qso':
      return randomQso(rng)
    case 'custom':
      return o.custom.trim().toUpperCase()
  }
}

export type Mark = 'ok' | 'wrong' | 'missed' | 'extra'

export interface Aligned {
  sent: string
  typed: string
  mark: Mark
}

export interface Score {
  total: number
  correct: number
  accuracy: number
  alignment: Aligned[]
  /** Per sent character: how many were sent and how many were not copied correctly. */
  perChar: Record<string, { sent: number; miss: number }>
}

/** Uppercase, spaces and line breaks removed; prosigns are kept as written. */
export function normalizeCopy(s: string): string {
  return s.toUpperCase().replace(/\s+/g, '')
}

/**
 * Scores copied text against what was sent by edit-distance alignment, so one dropped character
 * does not make everything after it wrong. Spacing is ignored.
 */
export function scoreCopy(sent: string, typed: string): Score {
  // Each prosign counts as one symbol.
  const sa = splitSymbols(sent)
  const sb = splitSymbols(typed)
  const n = sa.length
  const m = sb.length
  const d: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))
  for (let i = 0; i <= n; i++) d[i][0] = i
  for (let j = 0; j <= m; j++) d[0][j] = j
  for (let i = 1; i <= n; i++)
    for (let j = 1; j <= m; j++) d[i][j] = Math.min(d[i - 1][j - 1] + (sa[i - 1] === sb[j - 1] ? 0 : 1), d[i - 1][j] + 1, d[i][j - 1] + 1)
  const al: Aligned[] = []
  let i = n
  let j = m
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && d[i][j] === d[i - 1][j - 1] + (sa[i - 1] === sb[j - 1] ? 0 : 1)) {
      al.push({ sent: sa[i - 1], typed: sb[j - 1], mark: sa[i - 1] === sb[j - 1] ? 'ok' : 'wrong' })
      i--
      j--
    } else if (i > 0 && d[i][j] === d[i - 1][j] + 1) {
      al.push({ sent: sa[i - 1], typed: '', mark: 'missed' })
      i--
    } else {
      al.push({ sent: '', typed: sb[j - 1], mark: 'extra' })
      j--
    }
  }
  al.reverse()
  const perChar: Score['perChar'] = {}
  let correct = 0
  for (const x of al) {
    if (x.mark === 'extra') continue
    const e = (perChar[x.sent] ??= { sent: 0, miss: 0 })
    e.sent++
    if (x.mark === 'ok') correct++
    else e.miss++
  }
  return { total: n, correct, accuracy: n === 0 ? 0 : correct / n, alignment: al, perChar }
}

function splitSymbols(s: string): string[] {
  const out: string[] = []
  const u = normalizeCopy(s)
  for (let i = 0; i < u.length; i++) {
    if (u[i] === '<') {
      const e = u.indexOf('>', i)
      if (e > i) {
        out.push(u.slice(i, e + 1))
        i = e
        continue
      }
    }
    out.push(u[i])
  }
  return out
}

/** Koch rule of thumb: add the next character at 90% copy accuracy. */
export const KOCH_PASS = 0.9
