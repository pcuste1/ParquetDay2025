import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs';
import { BucketStack } from './stacks/bucket-stack';
import { KinesisStack } from './stacks/kinesis-stack';
import { ParquetConversionStack } from './stacks/parquet-conversion-stack';

export class StackSet extends cdk.Stage {
    readonly bucketStack: BucketStack;
    readonly kinesisStack: KinesisStack;
    readonly parquetConversionStack: ParquetConversionStack;

    constructor(scope: Construct, stageName: string, props: cdk.StackProps) {
        super(scope, stageName, props);

        this.bucketStack = new BucketStack(
            this,
            'bucket-stack',
            stageName,
            {
                ...props,
                bucketName: 'parquet-day-output-bucket',
            }
        );

        this.kinesisStack = new KinesisStack(
            this,
            'kinesis-stack',
            stageName,
            {
                ...props,
                streamName: 'parquetDayInputStream'
            }
        );

        this.parquetConversionStack = new ParquetConversionStack(
            this,
            'parquet-conversion-stack',
            stageName,
            {
                ...props,
                bucket: this.bucketStack.bucket,
                inputStream: this.kinesisStack.stream,
                account: props.env!.account!.toString(),
                databaseName: 'parquetDayGlueDatabase'
            }
        );

    }
}