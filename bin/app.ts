#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { PipelineStack } from '../lib/pipeline';

const app = new cdk.App();
new PipelineStack(app, 'ParquetDay2025Stack', {
  env: {
      account: '957143341180',
      region: 'us-east-2'
  },
});

app.synth();