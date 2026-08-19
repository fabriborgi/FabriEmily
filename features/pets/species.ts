export type PetKind = 'animal' | 'plant';

export type SpeciesStat = 'hunger' | 'cleanliness' | 'affection' | 'water' | 'light';

export const STAT_LABELS: Record<SpeciesStat, string> = {
  hunger: 'Feed',
  cleanliness: 'Clean',
  affection: 'Play',
  water: 'Water',
  light: 'Light',
};

export type Species = {
  key: string;
  kind: PetKind;
  name: string;
  emoji: string;
  curiosity: string;
  /** Punti persi all'ora per statistica — usato da features/pets/care.ts. */
  decayPerHour: Partial<Record<SpeciesStat, number>>;
};

/**
 * Le 47 specie sono definitive (spec F4.1): la chiave è anche il nome del
 * file atteso in public/pets/<key>.png. I tassi di decadimento vengono da
 * un tempo base per categoria (domestico/fattoria 20h, esotico 30h,
 * fantastico 24h, piante 36h) modulato da un moltiplicatore per statistica
 * (0.4–1.5) pensato per dare personalità a ogni specie, come richiesto dal
 * README (es. koala: fame lenta; cane: gioco/affetto veloce; pony: fame
 * veloce).
 */
export const SPECIES: Species[] = [
  // --- Animali domestici (base 20h → 5.00/h) ---
  {
    key: 'pet_dog', kind: 'animal', name: 'Dog', emoji: '🐶',
    curiosity: 'Dogs can learn over 100 words and gestures, and they wag their tails differently depending on how they feel.',
    decayPerHour: { hunger: 5.0, cleanliness: 4.5, affection: 7.5 },
  },
  {
    key: 'pet_cat', kind: 'animal', name: 'Cat', emoji: '🐱',
    curiosity: "A cat's purr vibrates at a frequency that can help heal bones and reduce pain.",
    decayPerHour: { hunger: 4.0, cleanliness: 6.5, affection: 4.5 },
  },
  {
    key: 'pet_rabbit', kind: 'animal', name: 'Rabbit', emoji: '🐰',
    curiosity: 'Rabbits can see almost 360 degrees around them without turning their head.',
    decayPerHour: { hunger: 5.5, cleanliness: 5.0, affection: 5.0 },
  },
  {
    key: 'pet_hamster', kind: 'animal', name: 'Hamster', emoji: '🐹',
    curiosity: 'Hamsters stuff their cheek pouches so full of food they can hold almost their own body weight.',
    decayPerHour: { hunger: 4.5, cleanliness: 4.5, affection: 3.5 },
  },
  {
    key: 'pet_guinea_pig', kind: 'animal', name: 'Guinea pig', emoji: '🐹',
    curiosity: "Guinea pigs squeak with delight — it's called 'popcorning' when they jump for joy.",
    decayPerHour: { hunger: 6.0, cleanliness: 5.0, affection: 4.5 },
  },
  {
    key: 'pet_parrot', kind: 'animal', name: 'Parrot', emoji: '🦜',
    curiosity: 'Some parrots can live over 60 years and mimic hundreds of different sounds.',
    decayPerHour: { hunger: 4.5, cleanliness: 4.0, affection: 7.0 },
  },
  {
    key: 'pet_goldfish', kind: 'animal', name: 'Goldfish', emoji: '🐠',
    curiosity: 'Goldfish have a memory span of months, not seconds, despite the popular myth.',
    decayPerHour: { hunger: 3.5, cleanliness: 6.0, affection: 2.5 },
  },
  {
    key: 'pet_turtle', kind: 'animal', name: 'Turtle', emoji: '🐢',
    curiosity: "A turtle's shell is made of bone and is actually attached to its spine.",
    decayPerHour: { hunger: 3.0, cleanliness: 4.0, affection: 2.5 },
  },
  // --- Animali da fattoria (base 20h → 5.00/h) ---
  {
    key: 'pet_pony', kind: 'animal', name: 'Pony', emoji: '🐴',
    curiosity: 'Ponies are technically a small horse breed, not baby horses, and can be surprisingly strong for their size.',
    decayPerHour: { hunger: 7.5, cleanliness: 4.5, affection: 4.5 },
  },
  {
    key: 'pet_goat', kind: 'animal', name: 'Goat', emoji: '🐐',
    curiosity: 'Goats have rectangular pupils that give them an almost 320-degree field of view.',
    decayPerHour: { hunger: 6.5, cleanliness: 4.0, affection: 4.0 },
  },
  {
    key: 'pet_sheep', kind: 'animal', name: 'Sheep', emoji: '🐑',
    curiosity: 'Sheep can recognize and remember the faces of up to 50 other sheep for years.',
    decayPerHour: { hunger: 6.0, cleanliness: 3.5, affection: 3.5 },
  },
  {
    key: 'pet_cow', kind: 'animal', name: 'Cow', emoji: '🐄',
    curiosity: 'Cows have best friends and get stressed when they are separated from them.',
    decayPerHour: { hunger: 7.0, cleanliness: 4.5, affection: 3.5 },
  },
  {
    key: 'pet_pig', kind: 'animal', name: 'Pig', emoji: '🐷',
    curiosity: 'Pigs are among the smartest farm animals and can learn to play simple video games with a joystick.',
    decayPerHour: { hunger: 6.5, cleanliness: 6.0, affection: 4.0 },
  },
  {
    key: 'pet_capybara', kind: 'animal', name: 'Capybara', emoji: '🦫',
    curiosity: "Capybaras are the world's largest rodents and love relaxing in water with friends of any species.",
    decayPerHour: { hunger: 5.0, cleanliness: 3.5, affection: 5.5 },
  },
  // --- Animali esotici (base 30h → 3.33/h) ---
  {
    key: 'pet_koala', kind: 'animal', name: 'Koala', emoji: '🐨',
    curiosity: 'Koalas sleep up to 20 hours a day to conserve energy from their low-nutrient eucalyptus diet.',
    decayPerHour: { hunger: 1.67, cleanliness: 3.0, affection: 2.67 },
  },
  {
    key: 'pet_panda', kind: 'animal', name: 'Panda', emoji: '🐼',
    curiosity: 'Giant pandas spend up to 14 hours a day eating bamboo.',
    decayPerHour: { hunger: 4.33, cleanliness: 2.67, affection: 2.33 },
  },
  {
    key: 'pet_penguin', kind: 'animal', name: 'Penguin', emoji: '🐧',
    curiosity: 'In some penguin species, a male proposes to his mate with a pebble.',
    decayPerHour: { hunger: 3.33, cleanliness: 3.67, affection: 3.0 },
  },
  {
    key: 'pet_fox', kind: 'animal', name: 'Fox', emoji: '🦊',
    curiosity: "Foxes are thought to use the Earth's magnetic field to help them pounce accurately on hidden prey.",
    decayPerHour: { hunger: 3.0, cleanliness: 2.67, affection: 4.0 },
  },
  {
    key: 'pet_owl', kind: 'animal', name: 'Owl', emoji: '🦉',
    curiosity: 'Owls can rotate their heads up to 270 degrees without hurting themselves.',
    decayPerHour: { hunger: 2.67, cleanliness: 2.33, affection: 2.0 },
  },
  {
    key: 'pet_sloth', kind: 'animal', name: 'Sloth', emoji: '🦥',
    curiosity: 'Sloths move so slowly that algae grows on their fur, helping them blend into the trees.',
    decayPerHour: { hunger: 1.33, cleanliness: 1.67, affection: 1.67 },
  },
  {
    key: 'pet_otter', kind: 'animal', name: 'Otter', emoji: '🦦',
    curiosity: "Otters hold hands while sleeping so they don't drift apart in the water.",
    decayPerHour: { hunger: 4.0, cleanliness: 3.33, affection: 4.33 },
  },
  {
    key: 'pet_hedgehog', kind: 'animal', name: 'Hedgehog', emoji: '🦔',
    curiosity: 'Hedgehogs will chew on strong-smelling things and spread the foamy saliva on their own spines.',
    decayPerHour: { hunger: 2.67, cleanliness: 3.0, affection: 2.0 },
  },
  {
    key: 'pet_chameleon', kind: 'animal', name: 'Chameleon', emoji: '🦎',
    curiosity: 'Chameleons can move each eye independently to look in two directions at once.',
    decayPerHour: { hunger: 2.0, cleanliness: 2.0, affection: 1.33 },
  },
  {
    key: 'pet_flamingo', kind: 'animal', name: 'Flamingo', emoji: '🦩',
    curiosity: 'Flamingos are born gray and turn pink from pigments in the algae and shrimp they eat.',
    decayPerHour: { hunger: 3.33, cleanliness: 3.33, affection: 3.0 },
  },
  // --- Animali fantastici (base 24h → 4.17/h) ---
  {
    key: 'pet_unicorn', kind: 'animal', name: 'Unicorn', emoji: '🦄',
    curiosity: "Legend says a unicorn's horn can purify any water it touches.",
    decayPerHour: { hunger: 2.92, cleanliness: 4.58, affection: 4.17 },
  },
  {
    key: 'pet_dragon', kind: 'animal', name: 'Dragon', emoji: '🐉',
    curiosity: 'Old sailor tales say dragons hoard treasure not for greed, but to keep the warmth close.',
    decayPerHour: { hunger: 5.83, cleanliness: 2.92, affection: 3.33 },
  },
  {
    key: 'pet_phoenix', kind: 'animal', name: 'Phoenix', emoji: '🔥',
    curiosity: 'A phoenix is said to be reborn from its own ashes every few hundred years.',
    decayPerHour: { hunger: 2.5, cleanliness: 3.75, affection: 3.75 },
  },
  {
    key: 'pet_griffin', kind: 'animal', name: 'Griffin cub', emoji: '🦅',
    curiosity: 'Griffin cubs are said to be fiercely loyal to whoever raises them from birth.',
    decayPerHour: { hunger: 4.58, cleanliness: 3.75, affection: 4.17 },
  },
  {
    key: 'pet_kitsune', kind: 'animal', name: 'Nine-tailed fox', emoji: '🦊',
    curiosity: 'Folklore says a kitsune grows an extra tail for every hundred years it lives, up to nine.',
    decayPerHour: { hunger: 3.33, cleanliness: 4.17, affection: 5.0 },
  },
  {
    key: 'pet_kraken', kind: 'animal', name: 'Baby kraken', emoji: '🐙',
    curiosity: 'Even as a hatchling, a kraken can change the color of its skin to match any mood.',
    decayPerHour: { hunger: 5.0, cleanliness: 2.5, affection: 2.92 },
  },
  {
    key: 'pet_cloud_sprite', kind: 'animal', name: 'Cloud sprite', emoji: '☁️',
    curiosity: 'Cloud sprites are said to be woven from morning mist and only appear where the air is calm.',
    decayPerHour: { hunger: 2.08, cleanliness: 5.0, affection: 4.17 },
  },
  {
    key: 'pet_moon_rabbit', kind: 'animal', name: 'Moon rabbit', emoji: '🌙',
    curiosity: 'In many folk tales, the moon rabbit spends its nights pounding rice cakes on the moon.',
    decayPerHour: { hunger: 3.75, cleanliness: 4.17, affection: 4.58 },
  },
  // --- Piante (base 36h → 2.78/h) ---
  {
    key: 'plant_fern', kind: 'plant', name: 'Fern', emoji: '🌿',
    curiosity: 'Ferns are one of the oldest plant groups on Earth, older than most dinosaurs.',
    decayPerHour: { water: 3.33, light: 1.94 },
  },
  {
    key: 'plant_succulent', kind: 'plant', name: 'Succulent', emoji: '🪴',
    curiosity: 'Succulents store water in their thick leaves, letting them go weeks between waterings.',
    decayPerHour: { water: 1.39, light: 2.78 },
  },
  {
    key: 'plant_cactus', kind: 'plant', name: 'Cactus', emoji: '🌵',
    curiosity: 'Some cacti can survive over a year without any water at all.',
    decayPerHour: { water: 1.11, light: 3.06 },
  },
  {
    key: 'plant_bonsai', kind: 'plant', name: 'Bonsai', emoji: '🌳',
    curiosity: "A bonsai isn't a special species — it's any tree kept small through careful pruning over years.",
    decayPerHour: { water: 2.78, light: 2.5 },
  },
  {
    key: 'plant_orchid', kind: 'plant', name: 'Orchid', emoji: '🌺',
    curiosity: 'Orchids are one of the largest plant families, with tens of thousands of species.',
    decayPerHour: { water: 2.5, light: 3.33 },
  },
  {
    key: 'plant_sunflower', kind: 'plant', name: 'Sunflower', emoji: '🌻',
    curiosity: 'Young sunflowers track the sun across the sky, a movement called heliotropism.',
    decayPerHour: { water: 3.06, light: 3.89 },
  },
  {
    key: 'plant_tulip', kind: 'plant', name: 'Tulip', emoji: '🌷',
    curiosity: "Tulip bulbs were once worth more than gold during 17th-century 'tulip mania'.",
    decayPerHour: { water: 2.78, light: 2.78 },
  },
  {
    key: 'plant_bamboo', kind: 'plant', name: 'Bamboo', emoji: '🎋',
    curiosity: 'Some bamboo species can grow nearly a meter in a single day.',
    decayPerHour: { water: 3.61, light: 2.22 },
  },
  {
    key: 'plant_ivy', kind: 'plant', name: 'Ivy', emoji: '🍃',
    curiosity: 'Ivy can climb using tiny root-like structures that grip almost any surface.',
    decayPerHour: { water: 2.5, light: 1.67 },
  },
  {
    key: 'plant_aloe', kind: 'plant', name: 'Aloe vera', emoji: '🌱',
    curiosity: 'Aloe vera gel has been used to soothe skin for thousands of years.',
    decayPerHour: { water: 1.39, light: 2.78 },
  },
  {
    key: 'plant_lavender', kind: 'plant', name: 'Lavender', emoji: '💜',
    curiosity: "Lavender's scent comes from oils in tiny hairs covering its leaves and flowers.",
    decayPerHour: { water: 1.67, light: 3.61 },
  },
  {
    key: 'plant_venus_flytrap', kind: 'plant', name: 'Venus flytrap', emoji: '🪤',
    curiosity: 'A Venus flytrap counts — its trap only snaps shut after two touches within 20 seconds.',
    decayPerHour: { water: 3.33, light: 3.06 },
  },
  {
    key: 'plant_money_tree', kind: 'plant', name: 'Money tree', emoji: '🍀',
    curiosity: 'The money tree is often braided as a young plant, a shape it keeps for life.',
    decayPerHour: { water: 2.22, light: 2.22 },
  },
  {
    key: 'plant_peace_lily', kind: 'plant', name: 'Peace lily', emoji: '🕊️',
    curiosity: 'Peace lilies droop dramatically when thirsty, then perk back up within hours of watering.',
    decayPerHour: { water: 3.06, light: 1.67 },
  },
  {
    key: 'plant_moss_terrarium', kind: 'plant', name: 'Moss terrarium', emoji: '🌎',
    curiosity: 'Moss has no roots — it absorbs water and nutrients directly through its leaves.',
    decayPerHour: { water: 2.78, light: 1.39 },
  },
];
