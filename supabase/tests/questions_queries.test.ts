import { describe, it, expect, beforeEach } from 'vitest';
import { sql, signedInClient, resetData } from './helpers';
import {
  fetchCurrentRound,
  fetchAnswers,
  fetchHistory,
  drawQuestion,
  answerQuestion,
  skipQuestion,
} from '@/features/questions/queries';

// Nessuna fixture propria in questo file: le 300 domande reali (Task 5) sono
// già sufficienti per ogni test qui sotto, e nessuno di essi dipende dal
// contenuto testuale di una domanda specifica — solo dalla coerenza fra
// round e domanda. resetData() basta, senza toccare `questions`.
beforeEach(resetData);

describe('queries delle domande contro il database reale', () => {
  it('senza round attivo, fetchCurrentRound ritorna null', async () => {
    const client = await signedInClient();
    expect(await fetchCurrentRound(client)).toBeNull();
  });

  it('drawQuestion usa i nomi di parametro giusti e ritorna il round', async () => {
    const client = await signedInClient();
    const { data, error } = await drawQuestion('fabrizio', null, client);
    expect(error).toBeNull();
    expect(data?.drawn_by).toBe('fabrizio');
  });

  it('fetchCurrentRound porta con sé la domanda coerente col round', async () => {
    const client = await signedInClient();
    await drawQuestion('fabrizio', null, client);
    const current = await fetchCurrentRound(client);
    expect(current).not.toBeNull();
    // Non un testo letterale: con 300 domande reali seminate, quale venga
    // pescata non è prevedibile. Verifica invece la coerenza del join.
    expect(current!.question.id).toBe(current!.round.question_id);
    expect(current!.question.body.length).toBeGreaterThan(0);
    expect(current!.round.closed_at).toBeNull();
  });

  it('fetchAnswers non rivela nulla prima della chiusura, nemmeno la propria', async () => {
    const client = await signedInClient();
    const { data: round } = await drawQuestion('fabrizio', null, client);
    await answerQuestion(round!.id, 'fabrizio', 'la mia risposta', client);
    const answers = await fetchAnswers(round!.id, client);
    expect(answers).toHaveLength(0);
  });

  it('fetchAnswers rivela entrambe le risposte dopo la chiusura', async () => {
    const client = await signedInClient();
    const { data: round } = await drawQuestion('fabrizio', null, client);
    await answerQuestion(round!.id, 'fabrizio', 'una', client);
    await answerQuestion(round!.id, 'emily', 'due', client);
    const answers = await fetchAnswers(round!.id, client);
    expect(answers).toHaveLength(2);
  });

  it('answerQuestion traduce l’errore di una risposta vuota', async () => {
    const client = await signedInClient();
    const { data: round } = await drawQuestion('fabrizio', null, client);
    const { data, error } = await answerQuestion(round!.id, 'fabrizio', '   ', client);
    expect(data).toBeNull();
    expect(error).toBe('Write an answer first.');
  });

  it('skipQuestion chiude il round e ritorna true', async () => {
    const client = await signedInClient();
    const { data: round } = await drawQuestion('fabrizio', null, client);
    const { data, error } = await skipQuestion(round!.id, 'emily', client);
    expect(error).toBeNull();
    expect(data).toBe(true);
  });

  it('fetchHistory ritorna solo i round risposti, con le risposte', async () => {
    const client = await signedInClient();
    const { data: round1 } = await drawQuestion('fabrizio', null, client);
    await answerQuestion(round1!.id, 'fabrizio', 'una', client);
    await answerQuestion(round1!.id, 'emily', 'due', client);

    const { data: round2 } = await drawQuestion('fabrizio', null, client);
    await skipQuestion(round2!.id, 'emily', client);

    const history = await fetchHistory(client);
    expect(history).toHaveLength(1);
    expect(history[0].round.id).toBe(round1!.id);
    expect(history[0].answers).toHaveLength(2);
  });
});
