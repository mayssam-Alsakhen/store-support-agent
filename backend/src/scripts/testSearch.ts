import { searchKnowledge } from "../services/knowledgeService";
import { pool } from "../db";

async function main() {
  const question = process.argv.slice(2).join(" ");
  if (!question) {
    throw new Error(
      'Write a question, for example: npx tsx src/scripts/testSearch.ts "Can I send my mug back?"'
    );
  }

  const matches = await searchKnowledge(question, 3);

  console.log(`Question: ${question}\n`);
  for (const match of matches) {
    console.log(
      `${match.similarity.toFixed(3)}  ${match.title}  (${match.topic})`
    );
  }
}

main()
  .catch((error) => console.error("Search failed:", error.message))
  .finally(() => pool.end());