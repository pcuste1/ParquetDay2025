import { 
    aws_s3 as s3, 
    aws_glue as glue, 
    aws_kinesis as kinesis,
    aws_kinesisfirehose as kinesisfirehose,
    aws_iam as iam,
    StackProps,
    Stack,
    CfnResource
    // aws_lambda as lambda,
    // Duration
} from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface ParquetConversionStackProps extends StackProps {
    bucket: s3.IBucket;
    account: string;
    region: string;
    inputStream: kinesis.IStream
}

export class ParquetConversionStack extends Stack {
    readonly databaseName = 'firehosedb';
    readonly tableName = 'firehosegluetable';
    readonly classification = 'parquet';
    readonly logGroupName = '/aws/kinesisfirehose/firehose';

    constructor(scope: Construct, id: string, stageName: string, props: ParquetConversionStackProps) {
        super(scope, id);

        // create the glue database
        const glueDatabase = new glue.CfnDatabase(this, 'GlueDatabase', {
            catalogId: props.account,
            databaseInput: {
                name: this.databaseName
            }
        });

        // create the glue table with basic schema
        const glueTable = new glue.CfnTable(this, 'GlueTable', {
            databaseName: this.databaseName,
            catalogId: props.account,
            tableInput: {
                name: this.tableName,
                parameters: {
                    classification: this.classification,
                    compressionType: 'Snappy',
                    typeOfData: 'file'
                },
                storageDescriptor: {
                    columns: [
                        {
                            name: 'name',
                            type: 'string'
                        },
                        {
                            name: 'value',
                            type: 'double'
                        },
                    ],      
                    location: `s3://${props.bucket.bucketName}/`
                }
            }
        });
        glueTable.addDependency(glueDatabase);

        // create a python lambda function to transform the data into a flattened format
        // const flattenerLambda = new lambda.Function(this, 'FlattenDataFunction', {
        //     runtime: lambda.Runtime.PYTHON_3_12,
        //     description: 'Flattens nested json for firehose. Created on ' + new Date().toISOString(),
        //     handler: 'flattener.handle',
        //     code: lambda.Code.fromAsset('lambda'),
        //     timeout: Duration.seconds(60),
        // });

        // create Role for firehose delivery stream
        const firehoseRole = new iam.Role(this, `firehoseRole`, {
            assumedBy: new iam.ServicePrincipal('firehose.amazonaws.com'),
            inlinePolicies: {
                'allow-s3-kinesis-logs': new iam.PolicyDocument({
                    statements: [
                        new iam.PolicyStatement({
                            effect: iam.Effect.ALLOW,
                            actions: [
                                "kinesis:DescribeStream",
                                "kinesis:DescribeStreamSummary",
                                "kinesis:GetRecords",
                                "kinesis:GetShardIterator",
                                "kinesis:ListShards",
                                "kinesis:SubscribeToShard"
                            ],
                            resources: [props.inputStream.streamArn]
                        }),
                        new iam.PolicyStatement({
                            effect: iam.Effect.ALLOW,
                            actions: [
                                "s3:GetObject*",
                                "s3:GetBucket*",
                                "s3:List*",
                                "s3:DeleteObject*",
                                "s3:PutObject*",
                                "s3:Abort*"
                            ],
                            resources: [
                                props.bucket.bucketArn,
                                props.bucket.bucketArn + "/*"
                            ]
                        }),
                        new iam.PolicyStatement({
                            effect: iam.Effect.ALLOW,
                            actions: [
                                "logs:PutLogEvents"
                            ],
                            resources: ['*']
                        }),
                        new iam.PolicyStatement({
                            effect: iam.Effect.ALLOW,
                            resources: [`arn:aws:glue:${props.region}:${props.account}:catalog`, 
                                `arn:aws:glue:${props.region}:${props.account}:database/${this.databaseName}`, 
                                `arn:aws:glue:${props.region}:${props.account}:table/${this.databaseName}/${this.tableName}`],
                            actions: [
                                'glue:GetTable*', 
                                'glue:GetSchema*', 
                                'glue:GetDatabase', 
                                'glue:GetDatabases'
                            ]
                        })
                    ]
                })
            }
        });

        // add s3 permission
        // firehoseRole.addToPolicy(new iam.PolicyStatement({
        //     effect: iam.Effect.ALLOW,
        //     resources: [props.bucket.bucketArn],
        //     actions: [
        //         's3:AbortMultipartUpload', 
        //         's3:GetBucketLocation', 
        //         's3:GetObject', 
        //         's3:ListBucket', 
        //         's3:ListBucketMultipartUploads', 
        //         's3:PutObject',
        //     ],
        // }));

        // add kinesis read permission
        // firehoseRole.addToPolicy(
        //     new iam.PolicyStatement({
        //         actions: [
        //         'kinesis:DescribeStream',
        //         'kinesis:GetRecords',
        //         'kinesis:GetShardIterator',
        //         'kinesis:ListShards'
        //         ],
        //         resources: [props.inputStream.streamArn],
        //     }),
        // );

        // const firehosePolicy = new iam.Policy(this, 'FirehosePolicy', {
        //     roles: [firehoseRole],
        //     statements: [
        //         new iam.PolicyStatement({
        //             effect: iam.Effect.ALLOW,
        //             resources: [props.inputStream.streamArn],
        //             actions: ['kinesis:DescribeStream', 'kinesis:GetShardIterator', 'kinesis:GetRecords'],
        //         }),
        //     ],
        // });


        // add cloudwatch log put permission for error logging
        // new iam.Policy(this, 'FirehoseCloudwatchLogsPolicy', {
        //     roles: [firehoseRole],
        //     statements: [
        //         new iam.PolicyStatement({
        //             effect: iam.Effect.ALLOW,
        //             resources: ['*'],
        //             actions: ['logs:PutLogEvents']
        //         })
        //     ]
        // });

        // add glue permission
        // new iam.Policy(this, 'FirehoseGluePolicy', {
        //     roles: [firehoseRole],
        //     statements: [
        //         new iam.PolicyStatement({
        //             effect: iam.Effect.ALLOW,
        //             resources: [`arn:aws:glue:${props.region}:${props.account}:catalog`, 
        //                 `arn:aws:glue:${props.region}:${props.account}:database/${this.databaseName}`, 
        //                 `arn:aws:glue:${props.region}:${props.account}:table/${this.databaseName}/${this.tableName}`],
        //             actions: [
        //                 'glue:GetTable*', 
        //                 'glue:GetSchema*', 
        //                 'glue:GetDatabase', 
        //                 'glue:GetDatabases'
        //             ]
        //         })
        //     ]
        // });

        // add permission for the lambda function to be invoked by the firehose delivery stream
        // flattenerLambda.grantInvoke(firehoseRole);

        // create the firehose delivery stream
        const firehose = new kinesisfirehose.CfnDeliveryStream(this, 'Firehose', {
            deliveryStreamType: 'KinesisStreamAsSource',
            kinesisStreamSourceConfiguration: {
                kinesisStreamArn: props.inputStream.streamArn,
                roleArn: firehoseRole.roleArn,
            },
            extendedS3DestinationConfiguration: {
                bucketArn: props.bucket.bucketArn,
                bufferingHints: {
                    intervalInSeconds: 60,
                    sizeInMBs: 64,
                },
                cloudWatchLoggingOptions: {
                    enabled: true,
                    logGroupName: this.logGroupName,
                    logStreamName: 'logs'
                },
                // format to parquet using glue schema
                dataFormatConversionConfiguration: {
                    enabled: true,
                    inputFormatConfiguration: {
                        deserializer: {
                            openXJsonSerDe: {}
                        }
                    },
                    outputFormatConfiguration: {
                        serializer: {
                            parquetSerDe: {
                                compression: 'SNAPPY',
                                enableDictionaryCompression: true,
                                writerVersion: 'V2'
                            }
                        }
                    },
                    schemaConfiguration: {
                        catalogId: props.account,
                        databaseName: this.databaseName,
                        tableName: this.tableName,
                        region: props.region,
                        roleArn: firehoseRole.roleArn
                    }
                },
                roleArn: firehoseRole.roleArn,
                // processingConfiguration: {
                //     enabled: true,
                //     processors: [
                //         {
                //             type: 'Lambda',
                //             parameters: [
                //                 {
                //                     parameterName: 'LambdaArn',
                //                     parameterValue: flattenerLambda.functionArn
                //                 },
                //                 {
                //                     parameterName: 'RoleArn',
                //                     parameterValue: firehoseRole.roleArn
                //                 }
                //             ]
                //         }
                //     ]
                // }
            }
        });
        props.inputStream.grantReadWrite(firehoseRole);
        props.bucket.grantReadWrite(firehoseRole);
    }
}