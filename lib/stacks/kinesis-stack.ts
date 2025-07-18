import * as cdk from 'aws-cdk-lib'
import * as kinesis from 'aws-cdk-lib/aws-kinesis'
import { Construct } from 'constructs';

export interface KinesisStackProps extends cdk.StackProps {
    readonly streamName: string;
}

export class KinesisStack extends cdk.Stack {
    readonly stream: kinesis.IStream;


    constructor(scope: Construct, id: string, stageName: string, props: KinesisStackProps) {
        super(scope, id, props);

        this.stream = new kinesis.Stream(this, 'DataStream', 
        { 
            streamName: `${props.streamName}-${props.env!.account}`,
            shardCount: 1,
            removalPolicy: cdk.RemovalPolicy.RETAIN_ON_UPDATE_OR_DELETE
        });
}
}