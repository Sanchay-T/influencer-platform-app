import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Define a simple test tool
const tools = [
    {
        type: 'function',
        name: 'get_weather',
        description: 'Get the weather for a city',
        parameters: {
            type: 'object',
            properties: {
                city: { type: 'string' }
            },
            required: ['city']
        }
    }
];

async function testResponsesAPI() {
    console.log('\n🧪 Testing Responses API with function calling...\n');

    // Step 1: Initial request
    console.log('📤 Step 1: Sending initial request with tools...');
    let response = await client.responses.create({
        model: 'gpt-4o',
        input: 'What is the weather in Paris?',
        tools: tools
    });

    console.log(`📥 Response ID: ${response.id}`);
    console.log(`📥 Status: ${response.status}`);
    console.log(`📥 Output items: ${response.output?.length || 0}`);

    // Log all output items
    response.output?.forEach((item, i) => {
        console.log(`\n  Item ${i + 1}:`);
        console.log(`    Type: ${item.type}`);
        console.log(`    ID: ${item.id}`);
        if (item.type === 'function_call') {
            console.log(`    Name: ${item.name}`);
            console.log(`    Call ID: ${item.call_id}`);
            console.log(`    Arguments: ${item.arguments}`);
            console.log(`    Status: ${item.status}`);
        }
    });

    // Step 2: Check if there are function calls
    const functionCalls = response.output?.filter(item => item.type === 'function_call') || [];

    if (functionCalls.length > 0) {
        console.log(`\n📞 Found ${functionCalls.length} function call(s)`);

        // Execute the function (mock)
        const functionResult = {
            city: 'Paris',
            temperature: 22,
            condition: 'sunny'
        };

        console.log(`\n✅ Executed function, got result:`, JSON.stringify(functionResult, null, 2));

        // Step 3: Try to continue the conversation with the function result
        console.log('\n📤 Step 2: Attempting to send function result back...');

        // According to the migration docs, we append output to input for multi-turn
        // Let's try different approaches:

        console.log('\n--- Attempt 1: Using previous_response_id with new input ---');
        try {
            const response2 = await client.responses.create({
                model: 'gpt-4o',
                previous_response_id: response.id,
                input: `The weather in Paris is: ${JSON.stringify(functionResult)}`,
                tools: tools
            });
            console.log('✅ Success! Response 2 received');
            console.log(`📥 Response 2 output_text: ${response2.output_text}`);
        } catch (error) {
            console.log('❌ Failed:', error.message);
        }

        console.log('\n--- Attempt 2: Appending output to input array ---');
        try {
            let context = [
                { role: 'user', content: [{ type: 'input_text', text: 'What is the weather in Paris?' }] }
            ];

            // Append the previous response output
            context = context.concat(response.output);

            // Add function result
            context.push({
                role: 'user',
                content: [{
                    type: 'input_text',
                    text: `Function result: ${JSON.stringify(functionResult)}`
                }]
            });

            const response3 = await client.responses.create({
                model: 'gpt-4o',
                input: context,
                tools: tools
            });
            console.log('✅ Success! Response 3 received');
            console.log(`📥 Response 3 output_text: ${response3.output_text}`);
        } catch (error) {
            console.log('❌ Failed:', error.message);
        }

        console.log('\n--- Attempt 3: Adding function_call_output item ---');
        try {
            let context = [
                { role: 'user', content: [{ type: 'input_text', text: 'What is the weather in Paris?' }] }
            ];

            // Append the previous response output
            context = context.concat(response.output);

            // Add function call output as a distinct item
            context.push({
                type: 'function_call_output',
                call_id: functionCalls[0].call_id,
                output: JSON.stringify(functionResult)
            });

            const response4 = await client.responses.create({
                model: 'gpt-4o',
                input: context,
                tools: tools
            });
            console.log('✅ Success! Response 4 received');
            console.log(`📥 Response 4 output_text: ${response4.output_text}`);
        } catch (error) {
            console.log('❌ Failed:', error.message);
            console.log('Full error:', error);
        }

    } else {
        console.log('\n✅ No function calls in response');
        console.log(`📄 Final output: ${response.output_text}`);
    }
}

testResponsesAPI().catch(console.error);
