// TCM Atlas data types — shared between page and components

export interface TCMNode {
  id: string;
  name: string;
  nameZh: string;
  version: string;
  type: 'person' | 'text';
  domain: string[];
  era?: string;
  contribution?: string;
  mentalModels?: string[];
  mentalModelsZh?: string[];
  values?: string[];
  valuesZh?: string[];
  tensions?: string[];
  tensionsZh?: string[];
  keywords?: string[];
  topBigrams?: string[];
  medicalSchool?: string;
  crossCulturalParallels?: string[];
  isHistorical?: boolean;
  primaryLanguage?: string;
  crossDomain?: string[];
  outgoingEdges?: number;
  distillationScore?: number;
  grade?: string;
}

export interface TCMEdge {
  source: string;
  target: string;
  type: 'intellectual_influence' | 'textual_lineage' | 'cross_cultural_resonance' | 'school_complementary' | 'school_opposition' | 'theory_evolution';
  weight: number;
  sharedConcepts?: string[];
  sharedKeywords?: string[];
  description?: string;
  provenance?: {
    method: string;
    evidence?: string[];
  };
}
