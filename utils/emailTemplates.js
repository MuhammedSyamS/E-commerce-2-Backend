const getOrderConfirmationTemplate = (order) => {
    return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
        <h1 style="background-color: #000; color: #fff; padding: 20px; text-align: center;">Order Confirmed</h1>
        <div style="padding: 20px; border: 1px solid #ddd;">
            <p>Hi ${order.user?.firstName || 'Customer'},</p>
            <p>Thank you for your order! We're getting it ready to be shipped. We will notify you when it has been sent.</p>
            
            <h3>Order Details</h3>
            <p><strong>Order ID:</strong> ${order._id}</p>
            <p><strong>Total:</strong> ₹${order.totalPrice}</p>
            
            <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
                <thead>
                    <tr style="background-color: #f8f8f8; text-align: left;">
                        <th style="padding: 10px;">Item</th>
                        <th style="padding: 10px;">Qty</th>
                        <th style="padding: 10px;">Price</th>
                    </tr>
                </thead>
                <tbody>
                    ${order.orderItems.map(item => `
                        <tr>
                            <td style="padding: 10px; border-bottom: 1px solid #eee;">
                                ${item.name} <br>
                                <small style="color: #777;">${item.selectedVariant ? `${item.selectedVariant.size} - ${item.selectedVariant.color}` : ''}</small>
                            </td>
                            <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.qty}</td>
                            <td style="padding: 10px; border-bottom: 1px solid #eee;">₹${item.price}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>

            <div style="margin-top: 20px; text-align: center;">
                <a href="${process.env.CLIENT_URL || 'http://localhost:5173'}/order/${order._id}" style="background-color: #000; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Order</a>
            </div>
        </div>
        <p style="text-align: center; font-size: 12px; color: #999; margin-top: 20px;">
            &copy; ${new Date().getFullYear()} HighPhaus. All rights reserved.
        </p>
    </div>
    `;
};

const getReturnStatusTemplate = (order, item, status, comment) => {
    return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
        <h1 style="background-color: #000; color: #fff; padding: 20px; text-align: center;">Return Update</h1>
        <div style="padding: 20px; border: 1px solid #ddd;">
            <p>Hi ${order.user?.firstName || 'Customer'},</p>
            <p>The status of your return request for <strong>${item.name}</strong> has been updated.</p>
            
            <div style="background-color: #f4f4f4; padding: 15px; border-radius: 5px; margin: 20px 0; text-align: center;">
                <h2 style="margin: 0; color: #000;">${status}</h2>
                ${comment ? `<p style="margin-top: 10px; color: #555;">Note: ${comment}</p>` : ''}
            </div>

            <p>You can track the progress in your account.</p>

            <div style="margin-top: 20px; text-align: center;">
                <a href="${process.env.CLIENT_URL || 'http://localhost:5173'}/my-returns" style="background-color: #000; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Track Return</a>
            </div>
        </div>
    </div>
    `;
};

module.exports = { getOrderConfirmationTemplate, getReturnStatusTemplate };
