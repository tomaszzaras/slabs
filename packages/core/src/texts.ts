// Static room texts (names, field groups, field labels, start-point names) in English. The Polish originals live next to
// the room definitions (they are the artifact's wording); `tr` maps them. A test checks that every Polish text has a translation.
import type { Lang } from './messages';

export const EN: Record<string, string> = {
  // rooms
  'Salon': 'Living room', 'Sypialnia': 'Bedroom', 'Łazienka 1': 'Bathroom 1', 'Łazienka 2': 'Bathroom 2',
  'salonu': 'living room', 'łazienki': 'bathroom',
  // groups
  'Bryła': 'Shape', 'Wycięcia': 'Cut-outs', 'Okno': 'Window', 'Płyty': 'Plates', 'Start montażu': 'Start of installation', 'Pomieszczenie': 'Room', 'Układ desek': 'Board layout',
  // fields
  'Szerokość wnętrza': 'Interior width', 'Długość salonu': 'Living room length', 'Kąt dachu': 'Roof angle',
  'Wysokość pasa pod skosem (lewa)': 'Knee wall height (left)', 'Wnęka na zasłony (prawa)': 'Curtain niche (right)',
  'Wpust: szerokość': 'Recess: width', 'Wpust: długość': 'Recess: length', 'Zabudowa: szerokość': 'Built-in: width', 'Zabudowa: głębokość': 'Built-in: depth',
  'Wycięcie w ścianie z końca': 'Cut-out in the end wall', 'Wysokość tego wycięcia': 'Height of that cut-out',
  'Okno w ścianie z=0': 'Window in wall z=0', 'Odstęp okna od dachu, ściany i podłogi': 'Window gap to roof, wall and floor',
  'Długość płyty': 'Plate length', 'Szerokość płyty': 'Plate width',
  'Start domyślny na dachu (z)': 'Default start on the roof (z)', 'Start domyślny na szczytach (x)': 'Default start on the gables (x)',
  'Szerokość dachu (domu)': 'Roof width (house)', 'Szerokość sypialni od lewej ściany': 'Bedroom width from the left wall',
  'Płaski sufit u góry': 'Flat ceiling at the top', 'Wysokość płaskiego sufitu': 'Flat ceiling height',
  'Szerokość łazienki od prawej ściany': 'Bathroom width from the right wall', 'Długość łazienki (wzdłuż kalenicy)': 'Bathroom length (along the ridge)', 'Długość sypialni (wzdłuż kalenicy)': 'Bedroom length (along the ridge)',
  'Start domyślny na szczytach (cm od ścianki)': 'Default start on the gables (cm from the partition)',
  'Szerokość (x)': 'Width (x)', 'Długość (z)': 'Length (z)', 'Wysokość opaski na ścianach': 'Band height on the walls',
  'Wysokość pomieszczenia (tylko model 3D)': 'Room height (3D model only)', 'Deski biegną wzdłuż długości (z)': 'Boards run along the length (z)',
  'Start siatki desek (cm od ściany)': 'Start of the board grid (cm from the wall)',
  // start points
  'lewa połać': 'left slope', 'prawa przy wpuście': 'right, at the recess', 'prawa połać': 'right slope', 'prawa przy zabudowie': 'right, at the built-in',
  'ściana wycięcia': 'cut-out wall', 'szczyt z=0': 'gable z=0', 'szczyt przy wpuście': 'gable at the recess', 'szczyt przy zabudowie': 'gable at the built-in', 'szczyt z końca': 'gable at the end',
  'ścianka działowa': 'partition wall', 'sufit: siatka desek': 'ceiling: board grid', 'opaska: pierwsza ściana': 'band: first wall', 'opaska: druga ściana': 'band: second wall',
};

/** Translates a Polish room text; Polish returns it unchanged. Missing keys fall back to Polish (tests make sure there are none). */
export const tr = (lang: Lang, pl: string): string => (lang === 'pl' || !pl ? pl : EN[pl] ?? pl);
