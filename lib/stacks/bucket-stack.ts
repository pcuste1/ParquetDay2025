import * as cdk from 'aws-cdk-lib'
import * as s3 from 'aws-cdk-lib/aws-s3'
import { Construct } from 'constructs';

export interface BucketStackProps extends cdk.StackProps {
    readonly bucketName: string;
}

export class BucketStack extends cdk.Stack {
    readonly bucket: s3.IBucket;


    constructor(scope: Construct, id: string, stageName: string, props: BucketStackProps) {
        super(scope, id, props);
        // create a destination s3 bucket. We'll go ahead and enable 
        // encryption since it's a best practice. 
        this.bucket = new s3.Bucket(this, `${stageName}-${props.bucketName}`, 
        {
            bucketName: `${props.bucketName}-${props.env!.account}`,
            encryption: s3.BucketEncryption.KMS,
            removalPolicy: cdk.RemovalPolicy.RETAIN_ON_UPDATE_OR_DELETE
        });
    }
}