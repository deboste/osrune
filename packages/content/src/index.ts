export type AgeId = "fire" | "steam" | "orbital" | "oblivion";

export interface FallbackOption {
  label: string;
  effects: { target: "resources" | "relation"; id: string; delta: number }[];
}

export interface FallbackDecision {
  titre: string;
  texte: string;
  options: [FallbackOption, FallbackOption, FallbackOption];
}

export interface AgeContent {
  label: string;
  oneLineContext: string;
  figureNames: { name: string; gender: "f" | "m" }[];
  roles: string[];
  traits: string[];
  goals: string[];
  extraRoles: string[];
  fallbackDecisions: FallbackDecision[];
  fallbackQuotes: string[];
}

export const fire: AgeContent = {
  label: "Age du Feu",
  oneLineContext: "Un village de bois et de pierre claire. Le feu ne s'eteint jamais sous la halle.",
  figureNames: [
    { name: "Mira", gender: "f" },
    { name: "Corin", gender: "m" },
    { name: "Aldric", gender: "m" },
    { name: "Sella", gender: "f" },
    { name: "Borin", gender: "m" },
    { name: "Ysolde", gender: "f" },
    { name: "Tam", gender: "m" },
    { name: "Nora", gender: "f" },
  ],
  roles: ["tisserande", "forgeron", "meuniere", "bucheron", "potier", "berger"],
  traits: ["bavard", "anxieux", "tenace", "doux", "fier", "reveur", "prudent", "brave"],
  goals: [
    "Agrandir la halle avant l'hiver.",
    "Apprendre son metier a un jeune.",
    "Remplir le grenier du village.",
    "Construire une maison pour sa famille.",
    "Garder le feu allume quoi qu'il arrive.",
  ],
  extraRoles: ["aide", "porteuse", "garde", "cueilleur"],
  fallbackDecisions: [
    {
      titre: "Partager les reserves ?",
      texte: "Les greniers baissent. Faut-il rationner ou partager comme avant ?",
      options: [
        { label: "Rationner le grain", effects: [{ target: "resources", id: "food", delta: 8 }] },
        { label: "Festin du village", effects: [{ target: "resources", id: "food", delta: -10 }] },
        { label: "Troc au marche", effects: [{ target: "resources", id: "goods", delta: 6 }] },
      ],
    },
    {
      titre: "Aider le chantier ?",
      texte: "Le chantier attend des bras. Qui doit y aller demain ?",
      options: [
        { label: "Tous au chantier", effects: [{ target: "resources", id: "wood", delta: -6 }] },
        { label: "Garder les champs", effects: [{ target: "resources", id: "food", delta: 6 }] },
        { label: "Reposer les vieux", effects: [{ target: "resources", id: "goods", delta: -4 }] },
      ],
    },
    {
      titre: "Feu de la halle ?",
      texte: "La flamme faiblit la nuit. Faut-il veiller a tour de role ?",
      options: [
        { label: "Veillee partagee", effects: [{ target: "resources", id: "wood", delta: -5 }] },
        { label: "Laisser couver", effects: [{ target: "resources", id: "wood", delta: 5 }] },
        { label: "Fete des braises", effects: [{ target: "resources", id: "goods", delta: 4 }] },
      ],
    },
  ],
  fallbackQuotes: [
    "Le feu tient bon.",
    "Demain sera meilleur.",
    "Le bois est humide.",
    "On finit le mur.",
    "Le pain leve bien.",
  ],
};

export const content: Record<AgeId, AgeContent> = {
  fire,
  // v1 : seul fire est livre. Les autres ages reutilisent la meme forme.
  steam: { ...fire, label: "Age de la Vapeur", oneLineContext: "Verrouille en v1." },
  orbital: { ...fire, label: "Age Orbital", oneLineContext: "Verrouille en v1." },
  oblivion: { ...fire, label: "Oubli", oneLineContext: "Verrouille en v1." },
};
