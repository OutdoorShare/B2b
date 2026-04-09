export interface BackgroundImage {
  id: string;
  label: string;
  url: string;
  thumb: string;
}

export interface BackgroundCategory {
  id: string;
  label: string;
  emoji: string;
  images: BackgroundImage[];
}

const u = (id: string, w = 1920) =>
  `https://images.unsplash.com/photo-${id}?w=${w}&q=80&fit=crop&auto=format`;
const t = (id: string) => u(id, 400);

export const BACKGROUND_CATEGORIES: BackgroundCategory[] = [
  {
    id: "mountains",
    label: "Mountains",
    emoji: "⛰️",
    images: [
      { id: "m1", label: "Rocky Peaks",      url: u("1464822759023-fed622ff2c3b"), thumb: t("1464822759023-fed622ff2c3b") },
      { id: "m2", label: "Alpine Sunrise",   url: u("1506905925346-21bda4d32df4"), thumb: t("1506905925346-21bda4d32df4") },
      { id: "m3", label: "Snow-Capped Range",url: u("1519681393784-d120267933ba"), thumb: t("1519681393784-d120267933ba") },
      { id: "m4", label: "Mountain Meadow",  url: u("1501854140801-50d01698950b"), thumb: t("1501854140801-50d01698950b") },
      { id: "m5", label: "Dramatic Cliffs",  url: u("1483728642387-6c3bdd6c93e5"), thumb: t("1483728642387-6c3bdd6c93e5") },
      { id: "m6", label: "Highland Valley",  url: u("1454496522488-7a8e488e8606"), thumb: t("1454496522488-7a8e488e8606") },
    ],
  },
  {
    id: "lakes",
    label: "Lakes",
    emoji: "🏞️",
    images: [
      { id: "l1", label: "Crystal Lake",     url: u("1439066290859-50b90a05a52d"), thumb: t("1439066290859-50b90a05a52d") },
      { id: "l2", label: "Mountain Lake",    url: u("1501426026826-31c667bdf23d"), thumb: t("1501426026826-31c667bdf23d") },
      { id: "l3", label: "Calm Reflection",  url: u("1505118380757-91f5f5632de0"), thumb: t("1505118380757-91f5f5632de0") },
      { id: "l4", label: "Forest Lake",      url: u("1470770841072-f978cf4d019e"), thumb: t("1470770841072-f978cf4d019e") },
      { id: "l5", label: "Turquoise Waters", url: u("1476514525405-9ddb0c7da0e3"), thumb: t("1476514525405-9ddb0c7da0e3") },
      { id: "l6", label: "Sunset Lake",      url: u("1508739773434-c26b3d09e071"), thumb: t("1508739773434-c26b3d09e071") },
    ],
  },
  {
    id: "forests",
    label: "Forests",
    emoji: "🌲",
    images: [
      { id: "f1", label: "Pine Forest",      url: u("1448375240586-882707db888b"), thumb: t("1448375240586-882707db888b") },
      { id: "f2", label: "Sunlit Woods",     url: u("1511884642898-4c92249e20b6"), thumb: t("1511884642898-4c92249e20b6") },
      { id: "f3", label: "Autumn Forest",    url: u("1507003211169-0a1dd7228f2d"), thumb: t("1507003211169-0a1dd7228f2d") },
      { id: "f4", label: "Redwood Grove",    url: u("1542202229-7d93c33f5d07"), thumb: t("1542202229-7d93c33f5d07") },
      { id: "f5", label: "Forest Path",      url: u("1441974231531-c6227db76b6e"), thumb: t("1441974231531-c6227db76b6e") },
      { id: "f6", label: "Misty Trees",      url: u("1502082553048-f009b4e191fd"), thumb: t("1502082553048-f009b4e191fd") },
    ],
  },
  {
    id: "rivers",
    label: "Rivers",
    emoji: "🏔️",
    images: [
      { id: "r1", label: "Canyon River",     url: u("1501888659012-702c2ab15de0"), thumb: t("1501888659012-702c2ab15de0") },
      { id: "r2", label: "Rushing Rapids",   url: u("1529310399831-ed472b81d589"), thumb: t("1529310399831-ed472b81d589") },
      { id: "r3", label: "Calm Creek",       url: u("1502003148287-a8ef80854576"), thumb: t("1502003148287-a8ef80854576") },
      { id: "r4", label: "Mossy River",      url: u("1495107334309-fcf710a3f37e"), thumb: t("1495107334309-fcf710a3f37e") },
      { id: "r5", label: "River Valley",     url: u("1473773508845-188df298d2d1"), thumb: t("1473773508845-188df298d2d1") },
      { id: "r6", label: "Waterfall",        url: u("1432405252176-1c5f39c48d8b"), thumb: t("1432405252176-1c5f39c48d8b") },
    ],
  },
  {
    id: "beaches",
    label: "Beaches",
    emoji: "🏖️",
    images: [
      { id: "b1", label: "Sandy Shore",      url: u("1507525428034-b723cf961d3e"), thumb: t("1507525428034-b723cf961d3e") },
      { id: "b2", label: "Rocky Coastline",  url: u("1505118380757-91f5f5632de0"), thumb: t("1505118380757-91f5f5632de0") },
      { id: "b3", label: "Sunset Beach",     url: u("1490031372026-58f23d64a80e"), thumb: t("1490031372026-58f23d64a80e") },
      { id: "b4", label: "Ocean Waves",      url: u("1505459668311-8dfac7952bf0"), thumb: t("1505459668311-8dfac7952bf0") },
      { id: "b5", label: "Sea Cliffs",       url: u("1506905925346-21bda4d32df4"), thumb: t("1506905925346-21bda4d32df4") },
      { id: "b6", label: "Tropical Coast",   url: u("1520250497591-112f2f40a3f4"), thumb: t("1520250497591-112f2f40a3f4") },
    ],
  },
  {
    id: "desert",
    label: "Desert",
    emoji: "🏜️",
    images: [
      { id: "d1", label: "Sand Dunes",       url: u("1509316785289-025f5b846b35"), thumb: t("1509316785289-025f5b846b35") },
      { id: "d2", label: "Red Rock Canyon",  url: u("1474044159687-1ee9f3a51722"), thumb: t("1474044159687-1ee9f3a51722") },
      { id: "d3", label: "Desert Sunset",    url: u("1508765098680-5f3c93577c64"), thumb: t("1508765098680-5f3c93577c64") },
      { id: "d4", label: "Arches",           url: u("1548504769-900b70ed87c1"), thumb: t("1548504769-900b70ed87c1") },
      { id: "d5", label: "Desert Plains",    url: u("1528360983277-13d401cdc186"), thumb: t("1528360983277-13d401cdc186") },
      { id: "d6", label: "Mesa Overlook",    url: u("1426604966848-d7adac402bff"), thumb: t("1426604966848-d7adac402bff") },
    ],
  },
  {
    id: "snow",
    label: "Snow",
    emoji: "❄️",
    images: [
      { id: "s1", label: "Snowy Peaks",      url: u("1547235001-d73f43b2e86e"), thumb: t("1547235001-d73f43b2e86e") },
      { id: "s2", label: "Winter Forest",    url: u("1491466153228-60c3a8e9c033"), thumb: t("1491466153228-60c3a8e9c033") },
      { id: "s3", label: "Frozen Lake",      url: u("1548681528-1a34c03f9bd7"), thumb: t("1548681528-1a34c03f9bd7") },
      { id: "s4", label: "Snow-Covered Pine",url: u("1548263594-a71ea65a8598"), thumb: t("1548263594-a71ea65a8598") },
      { id: "s5", label: "Blizzard Ridge",   url: u("1518021964703-4b2030f03085"), thumb: t("1518021964703-4b2030f03085") },
      { id: "s6", label: "Arctic Tundra",    url: u("1519281066-f0bafe3b67f0"), thumb: t("1519281066-f0bafe3b67f0") },
    ],
  },
  {
    id: "sky",
    label: "Sky",
    emoji: "🌅",
    images: [
      { id: "sk1", label: "Golden Sunset",   url: u("1506905925346-21bda4d32df4"), thumb: t("1506905925346-21bda4d32df4") },
      { id: "sk2", label: "Milky Way",       url: u("1419242902214-272b3f1d0a73"), thumb: t("1419242902214-272b3f1d0a73") },
      { id: "sk3", label: "Storm Clouds",    url: u("1561553873-a0bf9d8f8680"), thumb: t("1561553873-a0bf9d8f8680") },
      { id: "sk4", label: "Sunrise Glow",    url: u("1470770841072-f978cf4d019e"), thumb: t("1470770841072-f978cf4d019e") },
      { id: "sk5", label: "Northern Lights", url: u("1531366936337-7c912a4589a7"), thumb: t("1531366936337-7c912a4589a7") },
      { id: "sk6", label: "Blue Sky Clouds", url: u("1518495973542-4542adba09a0"), thumb: t("1518495973542-4542adba09a0") },
    ],
  },
];
