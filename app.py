import numpy as np
import pandas as pd
import json
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
import tensorflow as tf
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import Dense, Input
from tensorflow.keras.callbacks import Callback
from sklearn.metrics import mean_squared_error, r2_score
import sys
import asyncio
import websockets

async def send_message(message):
    uri = "ws://localhost:8081"
    async with websockets.connect(uri) as websocket:
        await websocket.send(message)

class ProgressCallback(Callback):
    def on_epoch_end(self, epoch, logs=None):
        progress = (epoch + 1) / self.params['epochs']
        data = {
            'type': 'progress',
            'progress': progress,
            'logs': logs
        }
        message = json.dumps(data)
        asyncio.run(send_message(message))

def main(file_path):
    # Load the dataset
    data = pd.read_csv(file_path)

    # Check if the dataset has any missing values
    if data.isnull().values.any():
        data = data.dropna()

    # Select only numeric columns for features
    numeric_features = data.select_dtypes(include=[np.number]).columns.tolist()
    X = data[numeric_features].iloc[:, :-1].values
    y = data[numeric_features].iloc[:, -1].values

    # Feature scaling
    scaler = StandardScaler()
    X = scaler.fit_transform(X)

    # Split data into training and test sets
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    # Create a neural network model
    model = Sequential()
    model.add(Input(shape=(X_train.shape[1],)))
    model.add(Dense(units=64, activation='relu'))
    model.add(Dense(units=32, activation='relu'))
    model.add(Dense(units=1))

    # Compile the model
    model.compile(optimizer='adam', loss='mean_squared_error')

    # Train the model with progress callback
    progress_callback = ProgressCallback()
    model.fit(X_train, y_train, epochs=10, callbacks=[progress_callback])

    # Evaluate the model
    y_pred = model.predict(X_test).flatten()
    mse = mean_squared_error(y_test, y_pred)
    r2 = r2_score(y_test, y_pred)

    # Prepare data for Highcharts
    highcharts_data = {
        'title': 'Simple Linear Regression',
        'xAxis': {
            'title': 'X',
            'categories': list(range(len(y_test)))
        },
        'yAxis': {
            'title': 'y'
        },
        'series': [
            {
                'name': 'Actual data',
                'data': y_test.tolist(),
                'type': 'scatter'
            },
            {
                'name': 'Predicted data',
                'data': y_pred.tolist(),
                'type': 'line'
            }
        ]
    }

    # Prepare additional data for JavaScript
    data = {
        'type': 'result',
        'Coefficients': model.get_weights()[0].tolist(),
        'Intercept': model.get_weights()[1].tolist(),
        'Mean_squared_error': mse,
        'Coefficient_of_determination': r2,
        'highcharts_data': highcharts_data
    }

    # Convert Python dictionary to JSON string
    json_output = json.dumps(data)

    # Send final result
    asyncio.run(send_message(json_output))

if __name__ == "__main__":
    file_path = sys.argv[1]
    main(file_path)
