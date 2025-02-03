import numpy as np
import pandas as pd
import random


class ObjectiveFunction:
    def __init__(self, weights, mean_point):
        self.weights = np.array(weights)
        self.mean_point = np.array(mean_point)

    def calculate(self, selected_songs):
        selected_songs = np.array(selected_songs)
        assert selected_songs.shape[1] == len(self.weights) == len(self.mean_point), (
            "Liczba parametrów w piosenkach, wagach i punkcie średnim musi być taka sama."
        )
        diff = selected_songs - self.mean_point
        weighted_diff = diff ** 2 * self.weights
        objective_value = weighted_diff.sum()
        return objective_value


class SimulatedAnnealing:
    def __init__(self, dataset, num_songs, initial_temp, cooling_rate, max_iterations):
        self.dataset = dataset
        self.num_songs = num_songs
        self.initial_temp = initial_temp
        self.cooling_rate = cooling_rate
        self.max_iterations = max_iterations

    def optimize(self, objective_function):
        m, n = self.dataset.shape
        current_indices = random.sample(range(m), self.num_songs)
        current_value = objective_function.calculate(self.dataset[current_indices])

        best_indices = current_indices[:]
        best_value = current_value

        temp = self.initial_temp
        objective_values = []  # To store objective function values
        temperatures = []  # To store temperature values over iterations

        for _ in range(self.max_iterations):
            new_indices = current_indices.copy()
            new_indices[random.randint(0, self.num_songs - 1)] = random.choice(
                [i for i in range(m) if i not in new_indices]
            )
            new_value = objective_function.calculate(self.dataset[new_indices])

            delta = new_value - current_value
            if delta < 0 or random.random() < np.exp(-delta / temp):
                current_indices = new_indices
                current_value = new_value

                if current_value < best_value:
                    best_indices = current_indices[:]
                    best_value = current_value

            objective_values.append(current_value)  # Add current objective value
            temperatures.append(temp)  # Add current temperature
            temp *= self.cooling_rate

        return best_indices, best_value, objective_values, temperatures


class PlaylistGenerator:
    def __init__(self, dataset, num_songs, initial_temp, cooling_rate, max_iterations):
        self.dataset = dataset
        self.num_songs = num_songs
        self.initial_temp = initial_temp
        self.cooling_rate = cooling_rate
        self.max_iterations = max_iterations

    def generate(self, selected_indices, weights):
        mean_point = self.dataset.iloc[selected_indices][['popularity', 'energy', 'danceability']].mean().values

        # Filter dataset for similar songs
        filters = {
            "popularity": mean_point[0],
            "energy": mean_point[1],
            "danceability": mean_point[2]
        }
        filtered_dataset = self.dataset[~self.dataset.index.isin(selected_indices) & (
            (self.dataset['popularity'] >= filters["popularity"] * 0.8) &
            (self.dataset['popularity'] <= filters["popularity"] * 1.2) &
            (self.dataset['energy'] >= filters["energy"] * 0.8) &
            (self.dataset['energy'] <= filters["energy"] * 1.2) &
            (self.dataset['danceability'] >= filters["danceability"] * 0.8) &
            (self.dataset['danceability'] <= filters["danceability"] * 1.2)
        )]

        objective_function = ObjectiveFunction(weights, mean_point)
        features = filtered_dataset[['popularity', 'energy', 'danceability']].values
        num_sa_songs = self.num_songs - len(selected_indices)  # Calculate how many songs SA should select

        if num_sa_songs <= 0:
            return self.dataset.iloc[selected_indices], [], []  # Return only input songs if no extra songs are needed

        sa = SimulatedAnnealing(
            dataset=features,
            num_songs=num_sa_songs,
            initial_temp=self.initial_temp,
            cooling_rate=self.cooling_rate,
            max_iterations=self.max_iterations
        )

        best_indices, _, objective_values, temperatures = sa.optimize(objective_function)

        # Combine input songs and selected songs from SA
        final_playlist = pd.concat([
            self.dataset.iloc[selected_indices],
            filtered_dataset.iloc[best_indices]
        ])

        return final_playlist, objective_values, temperatures
