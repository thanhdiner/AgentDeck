import {
  Workflow,
  WorkflowStep,
  WorkflowTemplate,
  AgentProfile,
  Skill,
  WorkflowStatus,
  WorkflowStepStatus,
  WorkflowLogEntry,
  WorkspaceId,
  TaskId,
  PaneId
} from './types.js';

export function getBuiltinTemplates(): WorkflowTemplate[] {
  return [
    {
      id: 'template-full-dev-pipeline',
      name: 'Full Development Pipeline',
      description: 'A 5-step automation: Plan → Code → Review → Test → Document',
      steps: [
        {
          label: 'Plan Architecture',
          agentName: 'Claude Code',
          skillName: 'Architect Plan',
          promptOverride: 'Please plan the implementation for the task: "{{taskTitle}}". Outline the required changes, folder structure, and necessary updates. Create a detailed architectural design.',
          maxRetries: 1
        },
        {
          label: 'Implement Feature',
          agentName: 'Claude Code',
          skillName: 'Web Application',
          promptOverride: 'Based on the architectural plan, implement the codebase modifications. Ensure the web application design rules are strictly followed (Curated color palettes, dark mode, smooth micro-animations, no browser defaults).',
          maxRetries: 1
        },
        {
          label: 'Review Code Changes',
          agentName: 'Agent Reviewer',
          skillName: 'Security Audit',
          promptOverride: 'Examine the Git changes and terminal outputs. Look for logic bugs, styling alignment issues, potential memory leaks, or security vulnerabilities.',
          maxRetries: 1
        },
        {
          label: 'Run & Verify Tests',
          agentName: 'Claude Code',
          skillName: null,
          promptOverride: 'Execute any automated test suites, typechecks, or build commands. Verify that there are no errors in execution.',
          maxRetries: 1
        },
        {
          label: 'Update Documentation',
          agentName: 'Claude Code',
          skillName: 'Write README',
          promptOverride: 'Generate clean markdown documentation. Update README.md or relevant project files with clear instructions on usage and configuration.',
          maxRetries: 1
        }
      ]
    },
    {
      id: 'template-code-review',
      name: 'Code & Review Loop',
      description: 'Implement a feature and then immediately run a safety and logic audit.',
      steps: [
        {
          label: 'Code Implementation',
          agentName: 'Claude Code',
          skillName: 'Web Application',
          promptOverride: 'Implement the task: "{{taskTitle}}" with description: "{{taskDescription}}".',
          maxRetries: 1
        },
        {
          label: 'Review Implementation',
          agentName: 'Agent Reviewer',
          skillName: null,
          promptOverride: 'Review the changes implemented in the previous step. Suggest fixes if any logic or styling issues are found.',
          maxRetries: 1
        }
      ]
    },
    {
      id: 'template-test-repair',
      name: 'Test & Repair Loop',
      description: 'Run tests first, detect any failures, and direct a coder agent to fix them.',
      steps: [
        {
          label: 'Execute Test Suite',
          agentName: 'Claude Code',
          skillName: null,
          promptOverride: 'Run all project unit tests and build tasks to inspect for any compile errors or failing test assertions.',
          maxRetries: 1
        },
        {
          label: 'Repair Failures',
          agentName: 'Claude Code',
          skillName: null,
          promptOverride: 'Inspect the test output. Find the root cause of any failures and modify the source code to resolve the problems.',
          maxRetries: 1
        }
      ]
    }
  ];
}

export function createWorkflowFromTemplate(
  template: WorkflowTemplate,
  workspaceId: WorkspaceId,
  taskId: TaskId | null,
  taskTitle: string,
  taskDescription: string,
  agentProfiles: AgentProfile[],
  skills: Skill[]
): Workflow {
  const timestamp = Date.now();
  const workflowId = `wf-${timestamp}-${Math.random().toString(36).substr(2, 9)}`;

  const steps: WorkflowStep[] = template.steps.map((s, idx) => {
    // Search agent profile by name matching
    let matchedAgent = agentProfiles.find(
      (a) => a.name.toLowerCase() === s.agentName.toLowerCase()
    );
    if (!matchedAgent) {
      matchedAgent = agentProfiles.find((a) =>
        a.name.toLowerCase().includes(s.agentName.toLowerCase())
      );
    }
    // Fallback to first available CLI agent
    const agentId = matchedAgent?.id || agentProfiles[0]?.id || 'agent-claude-code';

    // Search skill by name
    let matchedSkill: Skill | undefined;
    if (s.skillName) {
      matchedSkill = skills.find((sk) => sk.name.toLowerCase() === s.skillName!.toLowerCase());
      if (!matchedSkill) {
        matchedSkill = skills.find((sk) => sk.name.toLowerCase().includes(s.skillName!.toLowerCase()));
      }
    }

    const stepId = `step-${timestamp}-${idx}-${Math.random().toString(36).substr(2, 5)}`;

    // Compile variables inside the prompt override
    let promptOverride = s.promptOverride
      .replace(/\{\{taskTitle\}\}/g, taskTitle)
      .replace(/\{\{taskDescription\}\}/g, taskDescription);

    return {
      id: stepId,
      label: s.label,
      agentId,
      skillId: matchedSkill ? matchedSkill.id : null,
      promptOverride,
      status: 'pending',
      retryCount: 0,
      maxRetries: s.maxRetries || 1,
      runId: null,
      startedAt: null,
      finishedAt: null,
      errorSummary: ''
    };
  });

  const log: WorkflowLogEntry[] = [
    {
      timestamp,
      stepIndex: -1,
      message: `Workflow created from template: "${template.name}"`,
      level: 'info'
    }
  ];

  return {
    id: workflowId,
    name: template.name,
    description: template.description,
    steps,
    status: 'idle',
    currentStepIndex: 0,
    taskId,
    workspaceId,
    paneId: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    completedAt: null,
    log
  };
}

export function shouldRetry(step: WorkflowStep): boolean {
  return step.status === 'failed' && step.retryCount < step.maxRetries;
}

export function buildStepPrompt(
  step: WorkflowStep,
  workflow: Workflow,
  previousStepSummary?: string
): string {
  let prompt = step.promptOverride || '';
  if (previousStepSummary) {
    prompt = `[Context from Previous Step: "${workflow.steps[workflow.currentStepIndex - 1]?.label}"]\n${previousStepSummary}\n\n[Your Instructions]\n${prompt}`;
  }
  return prompt;
}

export function advanceWorkflow(
  workflow: Workflow,
  success: boolean,
  errorMessage: string = ''
): {
  workflow: Workflow;
  shouldRunNextStep: boolean;
  nextStepIndex: number;
} {
  const nextWorkflow = { ...workflow };
  const currentIdx = nextWorkflow.currentStepIndex;
  const currentStep = { ...nextWorkflow.steps[currentIdx] };
  const timestamp = Date.now();

  nextWorkflow.log = [...nextWorkflow.log];

  if (success) {
    currentStep.status = 'completed';
    currentStep.finishedAt = timestamp;
    nextWorkflow.steps[currentIdx] = currentStep;

    nextWorkflow.log.push({
      timestamp,
      stepIndex: currentIdx,
      message: `Step "${currentStep.label}" completed successfully.`,
      level: 'info'
    });

    const nextIdx = currentIdx + 1;
    if (nextIdx < nextWorkflow.steps.length) {
      nextWorkflow.currentStepIndex = nextIdx;
      nextWorkflow.steps[nextIdx] = {
        ...nextWorkflow.steps[nextIdx],
        status: 'pending'
      };
      nextWorkflow.updatedAt = timestamp;

      nextWorkflow.log.push({
        timestamp,
        stepIndex: nextIdx,
        message: `Moving to next step: "${nextWorkflow.steps[nextIdx].label}"`,
        level: 'info'
      });

      return {
        workflow: nextWorkflow,
        shouldRunNextStep: true,
        nextStepIndex: nextIdx
      };
    } else {
      nextWorkflow.status = 'completed';
      nextWorkflow.completedAt = timestamp;
      nextWorkflow.updatedAt = timestamp;

      nextWorkflow.log.push({
        timestamp,
        stepIndex: -1,
        message: 'Workflow completed all steps successfully!',
        level: 'info'
      });

      return {
        workflow: nextWorkflow,
        shouldRunNextStep: false,
        nextStepIndex: -1
      };
    }
  } else {
    // Retry check
    if (currentStep.retryCount < currentStep.maxRetries) {
      currentStep.retryCount += 1;
      currentStep.status = 'pending';
      nextWorkflow.steps[currentIdx] = currentStep;
      nextWorkflow.updatedAt = timestamp;

      nextWorkflow.log.push({
        timestamp,
        stepIndex: currentIdx,
        message: `Step "${currentStep.label}" failed: ${errorMessage}. Retrying (Attempt ${currentStep.retryCount}/${currentStep.maxRetries})...`,
        level: 'warn'
      });

      return {
        workflow: nextWorkflow,
        shouldRunNextStep: true,
        nextStepIndex: currentIdx
      };
    } else {
      currentStep.status = 'failed';
      currentStep.finishedAt = timestamp;
      currentStep.errorSummary = errorMessage;
      nextWorkflow.steps[currentIdx] = currentStep;

      nextWorkflow.status = 'failed';
      nextWorkflow.updatedAt = timestamp;

      nextWorkflow.log.push({
        timestamp,
        stepIndex: currentIdx,
        message: `Step "${currentStep.label}" failed permanently after ${currentStep.retryCount} retries. Error: ${errorMessage}`,
        level: 'error'
      });

      nextWorkflow.log.push({
        timestamp,
        stepIndex: -1,
        message: 'Workflow stopped due to step failure.',
        level: 'error'
      });

      return {
        workflow: nextWorkflow,
        shouldRunNextStep: false,
        nextStepIndex: -1
      };
    }
  }
}
