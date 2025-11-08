#!/usr/bin/env python3
"""
Upload a model file to S3 and print the public URL (or the object path).

Usage:
  python scripts/upload_model_s3.py --bucket my-bucket --key models/resnet50_ewaste_traced.pt --file Final_DP/Model/resnet50_ewaste_traced.pt

Requires AWS credentials in environment (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY) or an IAM role.
"""
import argparse
import boto3
from botocore.exceptions import ClientError

def upload(bucket, key, file_path, public=False):
    s3 = boto3.client('s3')
    extra = {}
    if public:
        extra['ACL'] = 'public-read'
    try:
        s3.upload_file(file_path, bucket, key, ExtraArgs=extra)
        url = f"https://{bucket}.s3.amazonaws.com/{key}"
        print(url)
        return url
    except ClientError as e:
        print('Upload failed:', e)
        raise

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--bucket', required=True)
    parser.add_argument('--key', required=True)
    parser.add_argument('--file', required=True)
    parser.add_argument('--public', action='store_true')
    args = parser.parse_args()
    upload(args.bucket, args.key, args.file, public=args.public)

if __name__ == '__main__':
    main()
