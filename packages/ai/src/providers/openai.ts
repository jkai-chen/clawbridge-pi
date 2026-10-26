import { openAIDecisionsApi } from "../api/openai-decisions.lazy.ts";
import { openAIResponsesApi } from "../api/openai-responses.lazy.ts";
import { envApiKeyAuth } from "../auth/helpers.ts";
import { createProvider, isModelType, type Provider } from "../models.ts";
import type { ClassifierModel } from "../types.ts";
import { OPENAI_CLASSIFIER_MODELS, OPENAI_MODELS } from "./openai.models.ts";

export function openaiProvider(): Provider<"openai-responses"> {
	return createProvider<"openai-responses">({
		id: "openai",
		name: "OpenAI",
		baseUrl: "https://api.openai.com/v1",
		auth: {
			apiKey: envApiKeyAuth("OpenAI API key", ["OPENAI_API_KEY"]),
		},
		models: [
			...Object.values(OPENAI_MODELS),
			...Object.values<ClassifierModel<"openai-decisions">>(OPENAI_CLASSIFIER_MODELS),
		],
		// Sign in with ChatGPT tokens only reach the Responses API; the Decisions API rejects them.
		filterAllModels: (models, credential) =>
			credential?.type === "oauth" ? models.filter((model) => !isModelType(model, "classifier")) : models,
		api: openAIResponsesApi(),
		classifiers: {
			"openai-decisions": openAIDecisionsApi(),
		},
	});
}
