import { 
    aws_s3 as s3, 
    aws_glue as glue, 
    aws_kinesis as kinesis,
    aws_kinesisfirehose as kinesisfirehose,
    aws_iam as iam,
    StackProps,
    Stack,
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
                    typeOfData: 'file',
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
                        {
                            name: 'timestamp',
                            type: 'string'
                        }
                    ],      
                    location: `s3://${props.bucket.bucketName}/parquetdata/`
                },
                partitionKeys: [
                    {
                        name: "year",
                        type: "string"
                    },
                    {
                        name: "month",
                        type: "string"
                    },
                    {
                        name: "day",
                        type: "string"
                    },
                    {
                        name: "hour",
                        type: "string"
                    }
                ]
            }
        });
        glueTable.addDependency(glueDatabase);

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

        // create the firehose delivery stream
        const firehose = new kinesisfirehose.CfnDeliveryStream(this, 'Firehose', {
            deliveryStreamType: 'KinesisStreamAsSource',
            kinesisStreamSourceConfiguration: {
                kinesisStreamArn: props.inputStream.streamArn,
                roleArn: firehoseRole.roleArn,
            },
            extendedS3DestinationConfiguration: {
                prefix: "parquetdata/year=!{partitionKeyFromQuery:year}/month=!{partitionKeyFromQuery:month}/day=!{partitionKeyFromQuery:day}/hour=!{partitionKeyFromQuery:hour}/",
                errorOutputPrefix: "errors/",
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
                processingConfiguration: {
                    enabled: true,
                    processors: [
                        {
                            type: 'AppendDelimiterToRecord'
                        },
                        {
                            type: 'MetadataExtraction',
                            parameters: [
                                {
                                parameterName: 'JsonParsingEngine',
                                parameterValue: 'JQ-1.6'
                                },
                                {
                                    parameterName: 'MetadataExtractionQuery',
                                    parameterValue: '{year:.timestamp[0:4],month:.timestamp[5:7],day:.timestamp[8:10],hour:.timestamp[11:13]}'
                                }
                            ]
                        }
                    ]
                },
                dynamicPartitioningConfiguration: {
                    enabled: true,
                    retryOptions: {
                        durationInSeconds:300
                    }
                }
            }
        });
        props.inputStream.grantReadWrite(firehoseRole);
        props.bucket.grantReadWrite(firehoseRole);
    }
}