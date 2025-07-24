import boto3
import os
import json
import random


# generate json data and write it to kinesis stream
def handle(event, context):
    payload = generate_random_data()
    # get streamname from env STREAM_NAME
    streamName = os.environ['STREAM_NAME']
    kinesis = boto3.client('kinesis')
    kinesis.put_record(
        StreamName=streamName,
        Data=json.dumps(payload),
        PartitionKey='1'
    )
                           

# generate random data
def generate_random_data():
    return {
        'name': 'test_name',
        'value': random.random()
    }