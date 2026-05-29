// #book ch16-pipeline
// ch16-multi-agent/server/src/lib/agent/multi/pipeline.ts
import { ReActAgent, type Tool } from '../react-agent.js';

export interface PipelineStage {
  name: string;
  description: string;
  tools: Tool[];
  maxSteps?: number;
  // Transform the previous stage's output into this stage's input
  buildPrompt: (previousOutput: string, originalInput: string) => string;
  // Validate that the output meets requirements (optional)
  validate?: (output: string) => { valid: boolean; reason?: string };
}

export interface PipelineResult {
  finalOutput: string;
  stageResults: Array<{
    stageName: string;
    input: string;
    output: string;
    durationMs: number;
    retries: number;
  }>;
  success: boolean;
}

export class AgentPipeline {
  constructor(
    private stages: PipelineStage[],
    private maxRetries = 2,
    private onStageComplete?: (stageName: string, output: string) => void,
  ) {}

  async run(initialInput: string): Promise<PipelineResult> {
    const stageResults: PipelineResult['stageResults'] = [];
    let currentOutput = initialInput;

    for (const stage of this.stages) {
      const start = Date.now();
      let retries = 0;
      let stageOutput = '';
      let success = false;

      while (retries <= this.maxRetries && !success) {
        const prompt = stage.buildPrompt(currentOutput, initialInput);

        const agent = new ReActAgent({
          tools: stage.tools,
          maxSteps: stage.maxSteps ?? 6,
          systemPrompt: stage.description,
        });

        const result = await agent.run(prompt);
        stageOutput = result.answer;

        // Validate output
        if (stage.validate) {
          const validation = stage.validate(stageOutput);
          if (!validation.valid) {
            retries++;
            if (retries <= this.maxRetries) {
              console.warn(
                `[Pipeline] "${stage.name}" validation failed (${retries}/${this.maxRetries}): ${validation.reason}`,
              );
            }
          } else {
            success = true;
          }
        } else {
          success = true;
        }
      }

      stageResults.push({
        stageName: stage.name,
        input: currentOutput.slice(0, 500),
        output: stageOutput,
        durationMs: Date.now() - start,
        retries,
      });

      this.onStageComplete?.(stage.name, stageOutput);
      currentOutput = stageOutput;
    }

    return {
      finalOutput: currentOutput,
      stageResults,
      success: true,
    };
  }
}
// #endbook
