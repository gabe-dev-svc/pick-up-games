import 'package:sign_ups_app/models/game.dart';

// represents a list of games returned by the API
class GameList {
  final List<Game> games;

  const GameList({
    required this.games
  });

  factory GameList.fromJson(Map<String, dynamic> json) {
    final rawList = json["games"] as List<dynamic>;
    final gamesList = rawList.map((l) => Game.fromJson(l)).toList();
    return GameList(games: gamesList);
  }
}