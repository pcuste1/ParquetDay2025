import * as cdk from 'aws-cdk-lib'
import * as glue from 'aws-cdk-lib/aws-glue'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as kinesis from 'aws-cdk-lib/aws-kinesis'
import * as kinesisfirehose from 'aws-cdk-lib/aws-kinesisfirehose'
import * as s3 from 'aws-cdk-lib/aws-s3'
import { Construct } from 'constructs';

export interface ParquetConversionStackProps extends cdk.StackProps {
    readonly account: string;
    readonly bucket: s3.IBucket;
    readonly inputStream: kinesis.IStream;
}

export class ParquetConversionStack extends cdk.Stack {
    readonly databaseName: string; 
    readonly tableName: string;
    readonly logGroupName: string;

    constructor(scope: Construct, id: string, stageName: string, props: ParquetConversionStackProps) {
        super(scope, id, props);

        this.databaseName = 'parquet-day-glue-database'
        this.tableName = 'parquet-day-glue-table'
        this.logGroupName = 'parquet-day-log-group'

        const firehoseRole = new iam.Role(this, 'firehoseRole', {
            assumedBy: new iam.ServicePrincipal('firehose.amazonaws.com'),
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonKinesisReadOnlyAcces')
            ]
        });
        firehoseRole.applyRemovalPolicy(cdk.RemovalPolicy.RETAIN_ON_UPDATE_OR_DELETE);

        const glueDatabase = new glue.CfnDatabase(this, 'GlueDatabase', {
            catalogId: props.account,
            databaseName: this.databaseName,
            databaseInput: {
                name: this.databaseName
            },
        });
        glueDatabase.applyRemovalPolicy(cdk.RemovalPolicy.RETAIN_ON_UPDATE_OR_DELETE);

        const glueTable = new glue.CfnTable(this, 'GlueTable', {
            databaseName: glueDatabase.databaseName!,
            catalogId: props.account,
            tableInput: {
                name: this.tableName,
                parameters: {
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
            },
        });
        glueTable.applyRemovalPolicy(cdk.RemovalPolicy.RETAIN_ON_UPDATE_OR_DELETE);

        const firehose = new kinesisfirehose.CfnDeliveryStream(this, 'Firehose', {
            deliveryStreamType: 'KinesisStreamAsSource',
            
            // input data source stream arn and role to use to access stream.
            kinesisStreamSourceConfiguration: {
                kinesisStreamArn: props.inputStream.streamArn,
                roleArn: firehoseRole.roleArn,
            },
            extendedS3DestinationConfiguration: {
                // output data source bucket arn
                bucketArn: props.bucket.bucketArn,
                
                // how long will firehose keep the data before converting/writing
                bufferingHints: {
                    intervalInSeconds: 60,
                    sizeInMBs: 64,
                },
                
                // Log configuration for cloudwatch
                cloudWatchLoggingOptions: {
                    enabled: true,
                    logGroupName: this.logGroupName,
                    logStreamName: 'logs'
                },
                
                // format conversion to parquet using glue schema
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
                        region: props.env!.region,
                        roleArn: firehoseRole.roleArn
                    }
                },
                
                // The firehose role
                roleArn: firehoseRole.roleArn,
                
                // // The data transformer configuration
                // processingConfiguration: {
                //     enabled: true,
                //     processors: [{
                //         type: 'Lambda',
                //         parameters: [
                //             {
                //                 parameterName: 'LambdaArn',
                //                 parameterValue: flattenerLambda.functionArn
                //             },
                //             {
                //                 parameterName: 'RoleArn',
                //                 parameterValue: firehoseRole.roleArn
                //             }
                //         ]
                //     }]
                // }
            }
        });
        firehose.applyRemovalPolicy(cdk.RemovalPolicy.RETAIN_ON_UPDATE_OR_DELETE);
    }
}