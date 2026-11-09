/**
 * Clasificador Naive Bayes multinomial con suavizado de Laplace.
 * Clasifica pares (métrica, dimensión) a partir de preguntas en español.
 */
import { features } from './text';
import { TRAINING_DATA, TrainingExample } from './training-data';
import type { Dimension, Metric } from '../report-spec';

export interface ClassLabel { metric: Metric; dimension: Dimension }
export interface ClassResult { label: ClassLabel; prob: number; logProb: number }

interface ClassStats {
  count: number;
  termFreq: Record<string, number>;
  vocabSize: number;
}

export class NaiveBayesClassifier {
  private classes = new Map<string, ClassStats>();
  private vocab = new Set<string>();
  private totalDocs = 0;

  static fromTraining(examples: TrainingExample[]): NaiveBayesClassifier {
    const nb = new NaiveBayesClassifier();
    for (const ex of examples) nb.addDocument(ex.text, ex.metric, ex.dimension);
    nb.finalize();
    return nb;
  }

  private labelKey(metric: Metric, dimension: Dimension): string { return `${metric}::${dimension}`; }
  private parseKey(key: string): ClassLabel {
    const [metric, dimension] = key.split('::') as [Metric, Dimension];
    return { metric, dimension };
  }

  private addDocument(text: string, metric: Metric, dimension: Dimension) {
    const key = this.labelKey(metric, dimension);
    if (!this.classes.has(key)) this.classes.set(key, { count: 0, termFreq: {}, vocabSize: 0 });
    const stats = this.classes.get(key)!;
    stats.count++;
    this.totalDocs++;
    for (const f of features(text)) {
      stats.termFreq[f] = (stats.termFreq[f] ?? 0) + 1;
      this.vocab.add(f);
    }
  }

  private finalize() {
    for (const stats of this.classes.values()) {
      stats.vocabSize = Object.values(stats.termFreq).reduce((a, b) => a + b, 0);
    }
  }

  classify(text: string): ClassResult[] {
    const feats = features(text);
    const V = this.vocab.size;
    const scores: ClassResult[] = [];

    for (const [key, stats] of this.classes) {
      const logPrior = Math.log(stats.count / this.totalDocs);
      let logLikelihood = 0;
      for (const f of feats) {
        const tf = stats.termFreq[f] ?? 0;
        // Laplace smoothing: (tf + 1) / (totalTerms + V)
        logLikelihood += Math.log((tf + 1) / (stats.vocabSize + V));
      }
      scores.push({ label: this.parseKey(key), prob: 0, logProb: logPrior + logLikelihood });
    }

    // Softmax sobre logProbs para obtener probabilidades
    const maxLog = Math.max(...scores.map((s) => s.logProb));
    const exps = scores.map((s) => Math.exp(s.logProb - maxLog));
    const sumExp = exps.reduce((a, b) => a + b, 0);
    scores.forEach((s, i) => { s.prob = exps[i] / sumExp; });

    return scores.sort((a, b) => b.prob - a.prob);
  }
}

/** Instancia singleton entrenada al arrancar el módulo */
let _classifier: NaiveBayesClassifier | null = null;
export function getClassifier(): NaiveBayesClassifier {
  if (!_classifier) _classifier = NaiveBayesClassifier.fromTraining(TRAINING_DATA);
  return _classifier;
}
