// represents a game returned by the API
class Game {
  final String gameId;
  final String category;
  final String name;
  final DateTime startTime;
  final String location;
  final List<String> roster;
  final List<String> waitList;
  final int teamSize;
  final int numTeams;
  final int signupFeeCents;
  final int splitFeeCents;

  const Game({
    required this.gameId,
    required this.category,
    required this.name,
    required this.startTime,
    required this.location,
    required this.roster,
    required this.waitList,
    required this.teamSize,
    required this.numTeams,
    required this.signupFeeCents,
    required this.splitFeeCents,
  });

  factory Game.fromJson(Map<String, dynamic> json) {
    var rosterList = json["roster"] as List<dynamic>;
    var waitList = json["waitList"] as List<dynamic>;
    return Game(
      gameId: json["gameId"] as String,
      category: json["category"] as String,
      name: json["name"] as String,
      startTime: DateTime.parse(json["startTime"] as String),
      location: json["location"] as String,
      roster: rosterList.whereType<String>().toList(),
      waitList:  waitList.whereType<String>().toList(),
      teamSize: json.containsKey("teamSize") ? json["teamSize"] as int  : 0,
      numTeams: json["numTeams"] as int,
      signupFeeCents: json["signupFeeCents"] as int,
      splitFeeCents: json["splitFeeCents"] as int,
    );
  }
}
