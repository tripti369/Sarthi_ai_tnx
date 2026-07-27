import { Report } from "../models/report.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const AGENT_MICROSERVICE_URL =
  "https://sarthi-ai-tnx-agents.onrender.com/api/agents/run";

/**
 * @desc    Execute multi-agent workflow query & save report
 * @route   POST /api/v1/workflow/run  or  GET /api/v1/workflow/run?query=...
 * @access  Public (Guest) or Private (If Authorization token provided)
 */
export const runAgentWorkflow = asyncHandler(async (req, res) => {
  const query = req.body?.query || req.query?.query;

  if (!query || !query.trim()) {
    if (req.method === "GET") {
      return res.status(200).json(
        new ApiResponse(
          200,
          {
            service: "Sarthi AI Workflow Engine API",
            status: "online",
            usage: {
              post: "POST /api/v1/workflow/run with JSON body { 'query': 'your research topic' }",
              get: "GET /api/v1/workflow/run?query=your+research+topic"
            }
          },
          "Sarthi AI Agent Workflow endpoint ready"
        )
      );
    }
    throw new ApiError(400, "Query string is required");
  }

  let agentResponseData;

  try {
    console.log(`[Workflow Controller] Calling HTTP Agent Microservice at: ${AGENT_MICROSERVICE_URL}`);
    const agentResponse = await fetch(AGENT_MICROSERVICE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: query.trim() }),
    });

    if (!agentResponse.ok) {
      const errorText = await agentResponse.text();
      console.error("Agent microservice returned error status:", agentResponse.status, errorText);
      throw new ApiError(agentResponse.status || 500, `Agent microservice error: ${errorText}`);
    }

    agentResponseData = await agentResponse.json();
    console.log("[Workflow Controller] Received successful response from HTTP Agent microservice.");
  } catch (err) {
    if (err instanceof ApiError) throw err;
    console.error(`[Workflow Controller] Could not reach HTTP Agent microservice (${AGENT_MICROSERVICE_URL}): ${err.message}`);
    throw new ApiError(503, `Agent microservice is unreachable at ${AGENT_MICROSERVICE_URL}. Please ensure python agent_server.py is running.`);
  }

  let responseData = {
    query: query.trim(),
    taskType: agentResponseData.taskType || "research",
    plan: agentResponseData.plan || {},
    analysis: agentResponseData.analysis || "",
    recommendations: agentResponseData.recommendations || "",
    report: agentResponseData.report || "",
    sources: agentResponseData.sources || [],
  };

  // Persist report in MongoDB if user is authenticated
  if (req.user && req.user._id) {
    const savedReport = await Report.create({
      user: req.user._id,
      ...responseData
    });
    responseData = savedReport;
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      responseData,
      "Multi-agent research workflow completed successfully"
    )
  );
});

/**
 * @desc    Get search & report history for current logged-in user
 * @route   GET /api/v1/workflow/reports
 * @access  Private (Protected by verifyJWT)
 */
export const getUserReports = asyncHandler(async (req, res) => {
  const reports = await Report.find({ user: req.user._id }).sort({ createdAt: -1 });

  return res.status(200).json(
    new ApiResponse(200, reports, "User reports retrieved successfully")
  );
});

/**
 * @desc    Get single report by ID
 * @route   GET /api/v1/workflow/reports/:id
 * @access  Private (Protected by verifyJWT)
 */
export const getReportById = asyncHandler(async (req, res) => {
  const report = await Report.findOne({
    _id: req.params.id,
    user: req.user._id,
  });

  if (!report) {
    throw new ApiError(404, "Report not found");
  }

  return res.status(200).json(
    new ApiResponse(200, report, "Report details retrieved successfully")
  );
});

/**
 * @desc    Delete report by ID
 * @route   DELETE /api/v1/workflow/reports/:id
 * @access  Private (Protected by verifyJWT)
 */
export const deleteReport = asyncHandler(async (req, res) => {
  const report = await Report.findOneAndDelete({
    _id: req.params.id,
    user: req.user._id,
  });

  if (!report) {
    throw new ApiError(404, "Report not found");
  }

  return res.status(200).json(
    new ApiResponse(200, {}, "Report deleted successfully")
  );
});
