import { buildDemoResponse } from "./demo";
import { AnalysisResponse, AnalyzeCreativeInput } from "./types";

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:8000";

export { DEMO_MODE };

export async function analyzeCreative(
  input: AnalyzeCreativeInput,
): Promise<AnalysisResponse> {
  if (DEMO_MODE) {
    await new Promise((resolve) => setTimeout(resolve, 1800));
    return buildDemoResponse();
  }

  const formData = new FormData();
  formData.append("file", input.file);
  formData.append("adType", input.adType);

  if (input.campaignGoal) {
    formData.append("campaignGoal", input.campaignGoal);
  }

  if (input.audience) {
    formData.append("audience", input.audience);
  }

  if (input.brandName) {
    formData.append("brandName", input.brandName);
  }

  const response = await fetch(`${API_BASE_URL}/analyze`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    let message = "Analysis failed. Please try again.";

    try {
      const data = (await response.json()) as { detail?: string };
      if (data.detail) {
        message = data.detail;
      }
    } catch {
      // Keep the default message if the backend did not return JSON.
    }

    throw new Error(message);
  }

  return (await response.json()) as AnalysisResponse;
}
