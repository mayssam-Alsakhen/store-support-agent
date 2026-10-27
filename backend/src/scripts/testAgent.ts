import { answerQuestion } from "../services/agentService";
import { pool } from "../db";

async function main() {
  const question = process.argv.slice(2).join(" ");
  if (!question) {
    throw new Error(
      'Write a question, for example: npx tsx src/scripts/testAgent.ts "Can I send my mug back?"'
    );
  }

  const { answer, sources } = await answerQuestion(question);

  console.log(`Question: ${question}\n`);
  console.log(`Answer: ${answer}\n`);
  console.log(`Sources used: ${sources.length > 0 ? sources.join(", ") : "none"}`);
}

main()
  .catch((error) => console.error("Agent failed:", error.message))
  .finally(() => pool.end());