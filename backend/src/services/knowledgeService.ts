import { ai } from "../gemini";
import { pool } from "../db";

export type KnowledgeMatch = {
  id: string;
  title: string;
  topic: string;
  content: string;
  similarity: number;
};

export async function searchKnowledge(
  question: string,
  limit = 3
): Promise<KnowledgeMatch[]> {
  const response = await ai.models.embedContent({
    model: "gemini-embedding-001",
    contents: question,
    config: { outputDimensionality: 768, taskType: "RETRIEVAL_QUERY" },
  });

  const values = response.embeddings?.[0]?.values;
  if (!values) {
    throw new Error("No embedding returned for the question");
  }
  const vector = `[${values.join(",")}]`;

  const result = await pool.query(
    `SELECT id, title, topic, content,
            1 - (embedding <=> $1::vector) AS similarity
     FROM knowledge_base
     ORDER BY embedding <=> $1::vector
     LIMIT $2`,
    [vector, limit]
  );

  return result.rows.map((row) => ({
    ...row,
    similarity: Number(row.similarity),
  }));
}