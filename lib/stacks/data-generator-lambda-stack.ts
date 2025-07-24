import * as cdk from 'aws-cdk-lib'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as kinesis from 'aws-cdk-lib/aws-kinesis'
import { Construct } from 'constructs';

export interface DataGeneratorLambdaProps extends cdk.StackProps {
    readonly inputStream: kinesis.IStream;
}

export class DataGeneratorLambda extends cdk.Stack {
    readonly function: lambda.IFunction;
    
    constructor(scope: Construct, id: string, props: DataGeneratorLambdaProps) {
        super(scope, id)

        this.function = new lambda.Function(this, 'DataGeneratorFunction', {
            runtime: lambda.Runtime.PYTHON_3_12,
            description: 'Generates random data to send to the kinesis stream. Created on ' + new Date().toISOString(),
            handler: 'generator.handle',
            code: lambda.Code.fromAsset('lambda'),
            environment: {
                STREAM_NAME: props.inputStream.streamName
            }
        });

        props.inputStream.grantWrite(this.function);
    }
}