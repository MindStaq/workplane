import type { CanonicalSkillWorkflow, SkillRunResult } from "./types.js";

export class CanonicalSkillRunner {
  async run<TInput, TOutput>(
    skill: CanonicalSkillWorkflow<TInput, TOutput>,
    input: TInput,
  ): Promise<SkillRunResult<TOutput>> {
    const resolved = await skill.resolveInputs(input);
    const context = await skill.buildContext(resolved);
    const aiOutput = await skill.invokeAI(context);
    const ref = await skill.persistOutput(aiOutput);

    if (skill.notify) {
      try {
        await skill.notify(ref);
      } catch {
        // notify failure never fails the run
      }
    }

    return { output: aiOutput.result, ref, metadata: aiOutput.metadata };
  }
}
