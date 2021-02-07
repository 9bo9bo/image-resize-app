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
    let format;
    const bucket = process.env.IMAGE_BUCKET;
    const objectKey = event.path.substring(1);
    const params = event.queryStringParameters || {};

    console.log({objectKey, params});

    return await S3.getObject({
        Bucket: bucket,
        Key: objectKey,
    }).promise()
        .then(data => {
            let image = Sharp(data.Body);

            const width = Number.parseInt(params.width);
            const height = Number.parseInt(params.height);
            const rotate = Number.parseInt(params.rotate);
            const x = Number.parseInt(params.x);
            const y = Number.parseInt(params.y);
            const fit = params.fit || 'inside';
            format = params.format || data.ContentType.split('/')[1];

            // rotate
            if (rotate) {
                image = image.rotate(rotate);
            }

            // extract
            if (Number.isInteger(x) && Number.isInteger(y) && width && height) {
                return image
                    .extract({left: x, top: y, width: width, height: height})
                    .toFormat(format)
                    .toBuffer();
            }

            // resize
            if (width && height) {
                image = image.resize(width, height, {fit});
            } else if (width) {
                image = image.resize(width, null, {fit});
            } else if (height) {
                image = image.resize(null, height, {fit});
            }

            return image
                .toFormat(format)
                .toBuffer();
        })
        .then(buffer => {
            return {
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
                return {
                    statusCode: 404,
                    body: JSON.stringify({message: err.message}),
                };
            }
            throw err;
        });
};
