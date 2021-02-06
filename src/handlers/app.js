'use strict';
const AWS = require('aws-sdk');
const S3 = new AWS.S3({
    signatureVersion: 'v4',
});
const Sharp = require('sharp');

/**
 *
 * Event doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html#api-gateway-simple-proxy-for-lambda-input-format
 * @param {Object} event - API Gateway Lambda Proxy Input Format
 *
 * Context doc: https://docs.aws.amazon.com/lambda/latest/dg/nodejs-prog-model-context.html
 * @param {Object} context
 *
 * Return doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html
 * @returns {Object} object - API Gateway Lambda Proxy Output Format
 *
 */
exports.lambdaHandler = async (event, context) => {
    let response = {};
    let format;
    const bucket = process.env.IMAGE_BUCKET;
    const objectKey = event.path.substring(1);
    const params = event.queryStringParameters || {};

    await S3.getObject({
        Bucket: bucket,
        Key: objectKey,
    }).promise()
        .then(data => {
            let image = Sharp(data.Body);

            const width = parseInt(params.width);
            const height = parseInt(params.height);
            const rotate = parseInt(params.rotate);
            const x = parseInt(params.x);
            const y = parseInt(params.y);
            const fit = params.fit || 'inside';
            format = params.format || data.ContentType.split('/')[1];

            // rotate
            if (rotate) {
                image = image.rotate(rotate);
            }

            // extract
            if (!isNaN(x) && !isNaN(y) && width && height) {
                return image
                    .extract({left: x, top: y, width: width, height: height})
                    .toFormat(format)
                    .toBuffer();
            }

            // resize
            if (width && height) {
                image = image.resize(width, height, {fit});
            } else if (width) {
                image = image.resize(width, {fit});
            } else if (height) {
                image = image.resize(null, height, {fit});
            }

            return image
                .toFormat(format)
                .toBuffer();
        })
        .then(buffer => {
            response = {
                statusCode: 200,
                headers: {
                    'content-type': `image/${format}`,
                    'cache-control': 'max-age=31536000'
                },
                isBase64Encoded: true,
                body: buffer.toString('base64'),
            };
        })
        .catch(err => {
            console.log("Exception while reading source image :%j", err);
            if (err.code === 'NoSuchKey') {
                response = {
                    statusCode: 404,
                }
                return;
            }
            throw err;
        });

    return response;
};
