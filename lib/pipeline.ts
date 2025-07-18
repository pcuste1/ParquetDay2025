import * as cdk from 'aws-cdk-lib';
import * as pipelines from 'aws-cdk-lib/pipelines';
import { Construct } from 'constructs';
import { StackSet } from './stages';


export class PipelineStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const pipeline = new pipelines.CodePipeline(this, 'Pipeline', {
      pipelineName: "ParquetDayPipeline",
      synth: new pipelines.ShellStep('Synth', {
        input: pipelines.CodePipelineSource.gitHub('pcuste1/ParquetDay2025', 'main'),
        commands: [
          'npm ci',
          'npm run build',
          'npx cdk synth',
        ],
      }),
    });

    const deploymentStage = pipeline.addStage(
      new StackSet(
        this,
        'deployment-stage',
        {
          env: { 
            account: '957143341180',
            region: 'us-east-2'
          }
        }
      )
    );

    deploymentStage.addPre(new pipelines.ManualApprovalStep('Manual Approval before deployment'));
  }
}
