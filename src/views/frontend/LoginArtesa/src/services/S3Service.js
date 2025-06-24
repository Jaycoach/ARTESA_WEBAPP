class S3Service {
  static getCloudFrontUrl(key) {
    const baseUrl = process.env.REACT_APP_CLOUDFRONT_URL || 'https://d1bqegutwmfn98.cloudfront.net';
    return `${baseUrl}/${key}`;
  }

  static async getSignedUrl(key) {
    try {
      // Llamar a tu API para obtener URL firmada
      const response = await API.get(`/upload/signed-url`, {
        params: { key }
      });
      return response.data.signedUrl;
    } catch (error) {
      console.error('Error obteniendo URL firmada:', error);
      return null;
    }
  }

  static getBucketInfo() {
    return {
      bucket: process.env.REACT_APP_S3_BUCKET_NAME || 'artesa-frontend-staging',
      distributionId: process.env.REACT_APP_CLOUDFRONT_DISTRIBUTION_ID || 'd1bqegutwmfn98',
      cloudFrontUrl: process.env.REACT_APP_CLOUDFRONT_URL || 'https://d1bqegutwmfn98.cloudfront.net',
      environment: process.env.REACT_APP_ENVIRONMENT || 'staging'
    };
  }
}

export default S3Service;