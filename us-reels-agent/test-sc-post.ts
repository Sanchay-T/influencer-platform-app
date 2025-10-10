import axios from 'axios';

const SC_API_KEY = 'Oy1ioE9pQTfUvuC1OvBmpIWHYZh1';
const SC = axios.create({
    baseURL: 'https://api.scrapecreators.com',
    headers: { 'x-api-key': SC_API_KEY },
    timeout: 30000
});

async function testPost() {
    const url = 'https://www.instagram.com/reel/DN286GsWui3';
    console.log('Testing ScrapeCreators POST API for:', url);
    
    try {
        const { data } = await SC.get('/v1/instagram/post', { 
            params: { url, trim: true } 
        });
        
        console.log('\n=== Raw API Response (owner section) ===');
        const owner = data?.data?.xdt_shortcode_media?.owner;
        console.log(JSON.stringify(owner, null, 2));
        
        console.log('\n=== Extracted Fields ===');
        console.log('username:', owner?.username);
        console.log('full_name:', owner?.full_name);
        console.log('is_verified:', owner?.is_verified);
    } catch (error: any) {
        console.error('Error:', error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', error.response.data);
        }
    }
}

testPost();
