export type ParkPhoto = {
  src: string;
  alt: string;
};

export const parkPhotos: Record<string, ParkPhoto> = {
  "bishan-park": {
    "src": "/images/bishan-park.jpg",
    "alt": "Kallang River and green riverbanks in Bishan–Ang Mo Kio Park",
  },
  "botanic-gardens": {
    "src": "/images/botanic-gardens.jpg",
    "alt": "Banyan branches over Swan Lake at Singapore Botanic Gardens",
  },
  "east-coast": {
    "src": "/images/east-coast.jpg",
    "alt": "Beach and palms at East Coast Park, Singapore",
  },
  "jurong-lake": {
    "src": "/images/jurong-lake.jpg",
    "alt": "Lotus pond and the Stoneboat at Jurong Lake Gardens",
  },
  "macritchie": {
    "src": "/images/macritchie.jpg",
    "alt": "Water and tree-lined banks at MacRitchie Reservoir Park",
  },
  "marina-barrage": {
    "src": "/images/marina-barrage.jpg",
    "alt": "Aerial view of Marina Barrage and its green rooftop lawn, Singapore",
  },
  "pasir-ris": {
    "src": "/images/pasir-ris.jpg",
    "alt": "Tree-lined coastal path at Pasir Ris Park",
  },
  "punggol-waterway": {
    "src": "/images/punggol-waterway.jpg",
    "alt": "Waterway, winding paths and red bridge at Punggol Waterway Park",
  },
  "southern-ridges": {
    "src": "/images/southern-ridges.jpg",
    "alt": "Henderson Waves bridge at the Southern Ridges, Singapore",
  },
  "woodlands-waterfront": {
    "src": "/images/woodlands-waterfront.jpg",
    "alt": "View of the jetty at Woodlands Waterfront Park",
  }
};
