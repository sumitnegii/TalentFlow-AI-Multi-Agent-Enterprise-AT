const { Anthropic } = require("@anthropic-ai/sdk");
const client = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY || "sk-ant-12345" });
async function run() {
  try {
    await client.messages.create({
      model: "claude-3-5-sonnet-latest",
      messages: [{ role: "user", content: "hi" }],
      max_tokens: 10
    });
  } catch (err) {
    console.log("err.status:", err.status);
    console.log("err.error:", err.error);
    console.log("err.message:", err.message);
    const cond = (err.status === 404 ||
      err.error?.type === "not_found_error" ||
      /not[_ ]found|model:/i.test(err.message || ""));
    console.log("cond is:", cond);
  }
}
run();
